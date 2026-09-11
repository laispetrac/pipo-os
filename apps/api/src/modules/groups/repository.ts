import { sql, type Kysely, type Selectable } from 'kysely'
import type { Database } from '../../infrastructure/db.js'
import type { TicketGroupMembers, TicketGroups } from '../../infrastructure/db-types.js'
import { ConflictError, NotFoundError } from '../../shared/errors.js'
import type { GroupNode } from './hierarchy.js'
import type {
  AddMemberBody,
  CreateGroupBody,
  Group,
  GroupDetailMember,
  GroupMember,
  ListGroupsQuery,
  MemberRole,
  UpdateGroupBody,
  UpdateMemberBody,
} from './schemas.js'

/** What a page of groups reads with, keyed by group id. */
export interface GroupRelations {
  companyIds: Map<string, string[]>
  members: Map<string, GroupDetailMember[]>
}

const PG_FK_VIOLATION = '23503'

function toGroup(row: Selectable<TicketGroups>): Group {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function toMember(row: Selectable<TicketGroupMembers>): GroupMember {
  return {
    groupId: row.group_id,
    userId: row.user_id,
    // The column is text; the CHECK of migration 0024 is what narrows it.
    role: row.role as MemberRole,
    active: row.active,
    createdAt: row.created_at.toISOString(),
  }
}

export interface GroupsRepositoryPort {
  create(data: CreateGroupBody, createdBy: string): Promise<Group>
  findById(id: string): Promise<Group | undefined>
  findMany(query: ListGroupsQuery): Promise<{ data: Group[]; total: number }>
  findNodes(): Promise<GroupNode[]>
  findRelations(groupIds: readonly string[]): Promise<GroupRelations>
  update(id: string, data: UpdateGroupBody, updatedBy: string): Promise<Group | undefined>
  delete(id: string): Promise<boolean>
}

export class GroupsRepository implements GroupsRepositoryPort {
  constructor(private readonly db: Kysely<Database>) {}

  async create(data: CreateGroupBody, createdBy: string): Promise<Group> {
    const row = await this.db
      .insertInto('ticket_groups')
      .values({ name: data.name, parent_id: data.parentId ?? null, created_by: createdBy })
      .returningAll()
      .executeTakeFirstOrThrow()

    return toGroup(row)
  }

  async findById(id: string): Promise<Group | undefined> {
    const row = await this.db
      .selectFrom('ticket_groups')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return row ? toGroup(row) : undefined
  }

  async findMany(query: ListGroupsQuery): Promise<{ data: Group[]; total: number }> {
    const offset = (query.page - 1) * query.pageSize

    const base = this.db.selectFrom('ticket_groups').$if(!!query.name, (q) => {
      const pattern = `%${query.name!.replace(/[\\%_]/g, '\\$&')}%`
      return q.where('name', 'ilike', pattern)
    })

    const rows = await base
      .selectAll()
      .select(sql<string>`count(*) over ()`.as('total_count'))
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(query.pageSize)
      .offset(offset)
      .execute()

    if (rows.length > 0) {
      return {
        data: rows.map((row) => toGroup(row as unknown as Selectable<TicketGroups>)),
        total: Number(rows[0].total_count),
      }
    }

    const { count } = await base
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow()

    return { data: [], total: Number(count) }
  }

  /** The whole tree, which the hierarchy rules walk in memory: three levels and
   *  dozens of rows make a recursive query a cost with no payer. */
  async findNodes(): Promise<GroupNode[]> {
    const rows = await this.db.selectFrom('ticket_groups').select(['id', 'parent_id']).execute()

    return rows.map((row) => ({ id: row.id, parentId: row.parent_id }))
  }

  /** Two queries for a whole page, never one per group: the portfolio, and the
   *  members already joined with the slice each of them follows. */
  async findRelations(groupIds: readonly string[]): Promise<GroupRelations> {
    const companyIds = new Map<string, string[]>()
    const members = new Map<string, GroupDetailMember[]>()
    if (groupIds.length === 0) return { companyIds, members }

    const carried = await this.db
      .selectFrom('ticket_group_companies')
      .select(['group_id', 'company_id'])
      .where('group_id', 'in', groupIds)
      .orderBy('company_id')
      .execute()

    for (const row of carried) {
      const list = companyIds.get(row.group_id) ?? []
      list.push(row.company_id)
      companyIds.set(row.group_id, list)
    }

    const rows = await this.db
      .selectFrom('ticket_group_members as m')
      .leftJoin('ticket_group_member_companies as mc', (join) =>
        join.onRef('mc.group_id', '=', 'm.group_id').onRef('mc.user_id', '=', 'm.user_id'),
      )
      .select(['m.group_id', 'm.user_id', 'm.role', 'm.active', 'mc.company_id'])
      .where('m.group_id', 'in', groupIds)
      .orderBy('m.user_id')
      .orderBy('mc.company_id')
      .execute()

    for (const row of rows) {
      const list = members.get(row.group_id) ?? []
      let member = list.at(-1)
      if (member?.userId !== row.user_id) {
        member = {
          userId: row.user_id,
          role: row.role as MemberRole,
          active: row.active,
          companyIds: [],
        }
        list.push(member)
        members.set(row.group_id, list)
      }
      if (row.company_id !== null) member.companyIds.push(row.company_id)
    }

    return { companyIds, members }
  }

  async update(id: string, data: UpdateGroupBody, updatedBy: string): Promise<Group | undefined> {
    const row = await this.db
      .updateTable('ticket_groups')
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.parentId !== undefined && { parent_id: data.parentId }),
        updated_by: updatedBy,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    return row ? toGroup(row) : undefined
  }

  async delete(id: string): Promise<boolean> {
    try {
      const [result] = await this.db.deleteFrom('ticket_groups').where('id', '=', id).execute()

      return (result?.numDeletedRows ?? 0n) > 0n
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === PG_FK_VIOLATION) {
        throw new ConflictError(`Group ${id} still has members`)
      }
      throw err
    }
  }
}

export interface GroupMembersRepositoryPort {
  add(groupId: string, data: AddMemberBody): Promise<GroupMember>
  remove(groupId: string, userId: string): Promise<boolean>
  update(groupId: string, userId: string, data: UpdateMemberBody): Promise<GroupMember | undefined>
}

export class GroupMembersRepository implements GroupMembersRepositoryPort {
  constructor(private readonly db: Kysely<Database>) {}

  async add(groupId: string, data: AddMemberBody): Promise<GroupMember> {
    const userId = data.userId
    try {
      const row = await this.db
        .insertInto('ticket_group_members')
        .values({ group_id: groupId, user_id: userId, ...(data.role && { role: data.role }) })
        .onConflict((oc) => oc.columns(['group_id', 'user_id']).doNothing())
        .returningAll()
        .executeTakeFirst()

      if (!row) {
        throw new ConflictError(`User ${userId} is already a member of group ${groupId}`)
      }

      return toMember(row)
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === PG_FK_VIOLATION) {
        throw new NotFoundError(`Group ${groupId} not found`)
      }
      throw err
    }
  }

  async remove(groupId: string, userId: string): Promise<boolean> {
    const [result] = await this.db
      .deleteFrom('ticket_group_members')
      .where('group_id', '=', groupId)
      .where('user_id', '=', userId)
      .execute()

    return (result?.numDeletedRows ?? 0n) > 0n
  }

  async update(
    groupId: string,
    userId: string,
    data: UpdateMemberBody,
  ): Promise<GroupMember | undefined> {
    const row = await this.db
      .updateTable('ticket_group_members')
      .set({
        ...(data.active !== undefined && { active: data.active }),
        ...(data.role !== undefined && { role: data.role }),
      })
      .where('group_id', '=', groupId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst()

    return row ? toMember(row) : undefined
  }
}
