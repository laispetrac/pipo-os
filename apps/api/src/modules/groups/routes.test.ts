import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { SESSION_COOKIE_NAME } from '../auth/session.js'

function cookieValue(
  response: { cookies: Array<{ name: string; value: string }> },
  name: string,
): string | null {
  return response.cookies.find((cookie) => cookie.name === name)?.value ?? null
}

const DEV_LOGIN_USER_ID = 'dev@piposaude.com.br'
const USER_ID_1 = '00000000-0000-4000-8000-000000000001'
const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000099'

describe('groups routes', () => {
  let app: FastifyInstance
  let sessionCookie: string

  beforeAll(async () => {
    process.env.DEV_LOGIN_ENABLED = 'true'
    app = buildApp()
    await app.ready()

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { policies: ['admin/allow/administrate/pipodesk/structure'] },
    })
    sessionCookie = cookieValue(loginResponse, SESSION_COOKIE_NAME)!
  })

  afterAll(async () => {
    await app.close()
    delete process.env.DEV_LOGIN_ENABLED
  })

  /* Leaf tables first, because the FKs demand it: `member_companies` points at
     both `companies` and `members`. A table added in the wrong position here
     reintroduces FK violations that read as unrelated test failures. */
  afterEach(async () => {
    await app.db.deleteFrom('ticket_group_member_companies').execute()
    await app.db.deleteFrom('ticket_group_companies').execute()
    await app.db.deleteFrom('ticket_group_members').execute()
    await app.db.deleteFrom('ticket_groups').execute()
  })

  const createGroup = async (name: string, parentId?: string | null): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/groups',
      payload: { name, ...(parentId !== undefined && { parentId }) },
      cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
    })
    expect(response.statusCode).toBe(201)
    return response.json().id as string
  }

  // ---------------------------------------------------------------------------
  describe('POST /api/groups', () => {
    it('returns 401 without session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Operações' },
      })

      expect(response.statusCode).toBe(401)
    })

    it('creates a group and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Operações' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.id).toBeTruthy()
      expect(body.name).toBe('Operações')
      expect(body.createdBy).toBe(DEV_LOGIN_USER_ID)
      expect(body.createdAt).toBeTruthy()
      expect(body.updatedAt).toBeTruthy()
    })

    it('returns 400 when name is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: {},
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 when name is empty string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: '' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    /** `min(1)` counts characters, and a space is a character: without a trim
     *  the group is created named " " and no search ever finds it. */
    it('returns 400 when name is only whitespace', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: '   ' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('stores the name trimmed, so two groups cannot differ by a space', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: '  Operações  ' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().name).toBe('Operações')
    })

    it('returns 400 for unknown field (strict schema)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo', campoInexistente: 'valor' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('creates a group without a parent and reports parentId as null', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Gestão de Benefícios' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().parentId).toBeNull()
    })

    it('nests a group under its parent', async () => {
      const geben = await createGroup('Gestão de Benefícios')

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'POD 3', parentId: geben },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().parentId).toBe(geben)
    })

    it('returns 400 when parentId is not a uuid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'POD 3', parentId: 'geben' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  // ---------------------------------------------------------------------------
  describe('GET /api/groups', () => {
    it('returns 401 without session cookie', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/groups' })
      expect(response.statusCode).toBe(401)
    })

    it('returns empty list when no groups exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups',
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data).toEqual([])
      expect(body.total).toBe(0)
      expect(body.page).toBe(1)
      expect(body.pageSize).toBe(20)
    })

    it('returns all created groups', async () => {
      const alpha = await createGroup('Alpha')
      await createGroup('Beta', alpha)

      const response = await app.inject({
        method: 'GET',
        url: '/api/groups',
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.total).toBe(2)
      expect(body.data).toHaveLength(2)
    })

    it('filters groups by name (case-insensitive)', async () => {
      const dental = await createGroup('Operações Dental')
      await createGroup('Suporte Médico', dental)

      const response = await app.inject({
        method: 'GET',
        url: '/api/groups?name=dental',
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.total).toBe(1)
      expect(body.data[0].name).toBe('Operações Dental')
    })

    it('paginates results', async () => {
      const raiz = await createGroup('Grupo 1')
      await createGroup('Grupo 2', raiz)
      await createGroup('Grupo 3', raiz)

      const page1 = await app.inject({
        method: 'GET',
        url: '/api/groups?page=1&pageSize=2',
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(page1.statusCode).toBe(200)
      const body1 = page1.json()
      expect(body1.total).toBe(3)
      expect(body1.data).toHaveLength(2)
      expect(body1.page).toBe(1)
      expect(body1.pageSize).toBe(2)

      const page2 = await app.inject({
        method: 'GET',
        url: '/api/groups?page=2&pageSize=2',
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(page2.statusCode).toBe(200)
      const body2 = page2.json()
      expect(body2.total).toBe(3)
      expect(body2.data).toHaveLength(1)

      const pageOut = await app.inject({
        method: 'GET',
        url: '/api/groups?page=99&pageSize=2',
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(pageOut.statusCode).toBe(200)
      const bodyOut = pageOut.json()
      expect(bodyOut.total).toBe(3)
      expect(bodyOut.data).toHaveLength(0)
    })

    it('returns 400 for invalid pageSize', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups?pageSize=999',
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  // ---------------------------------------------------------------------------
  describe('GET /api/groups/:id', () => {
    it('returns 401 without session cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/groups/${NONEXISTENT_ID}`,
      })
      expect(response.statusCode).toBe(401)
    })

    it('returns group by id', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Suporte' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id } = created.json()

      const response = await app.inject({
        method: 'GET',
        url: `/api/groups/${id}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().id).toBe(id)
      expect(response.json().name).toBe('Suporte')
    })

    it('reports the parent of a nested group', async () => {
      const geben = await createGroup('Gestão de Benefícios')
      const pod = await createGroup('POD 3', geben)

      const response = await app.inject({
        method: 'GET',
        url: `/api/groups/${pod}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().parentId).toBe(geben)
    })

    it('returns 404 for non-existent group', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/groups/${NONEXISTENT_ID}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  // ---------------------------------------------------------------------------
  describe('PATCH /api/groups/:id', () => {
    it('returns 401 without session cookie', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${NONEXISTENT_ID}`,
        payload: { name: 'Novo Nome' },
      })
      expect(response.statusCode).toBe(401)
    })

    it('updates group name and refreshes updatedAt', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Antigo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id, updatedAt: updatedAtBefore } = created.json()

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${id}`,
        payload: { name: 'Novo Nome' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.name).toBe('Novo Nome')
      expect(body.updatedBy).toBe(DEV_LOGIN_USER_ID)
      expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(updatedAtBefore).getTime(),
      )
    })

    it('returns 400 for unknown field (strict schema)', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id } = created.json()

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${id}`,
        payload: { name: 'Válido', campoInexistente: 'valor' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 404 for non-existent group', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${NONEXISTENT_ID}`,
        payload: { name: 'Novo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('moves a group to another parent without touching its name', async () => {
      const geben = await createGroup('Gestão de Benefícios')
      const pod3 = await createGroup('POD 3', geben)
      const subtime = await createGroup('Subtime', geben)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${subtime}`,
        payload: { parentId: pod3 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.parentId).toBe(pod3)
      expect(body.name).toBe('Subtime')
    })

    it('returns 400 for an empty body, which would be an update that updates nothing', async () => {
      const id = await createGroup('Gestão de Benefícios')

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${id}`,
        payload: {},
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('keeps the parent when the update only changes the name', async () => {
      const geben = await createGroup('Gestão de Benefícios')
      const pod = await createGroup('POD 3', geben)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${pod}`,
        payload: { name: 'POD 5' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.name).toBe('POD 5')
      expect(body.parentId).toBe(geben)
    })
  })

  // ---------------------------------------------------------------------------
  describe('the shape of the hierarchy', () => {
    const fieldsOf = (response: { json: () => { details?: Array<{ field: string }> } }): string[] =>
      (response.json().details ?? []).map((detail) => detail.field)

    it('refuses a second root, because the tree has one GEBEN', async () => {
      await createGroup('Gestão de Benefícios')

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Outra raiz' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(422)
      expect(fieldsOf(response)).toEqual(['parentId'])
    })

    it('refuses a parent that does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'POD 3', parentId: NONEXISTENT_ID },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(422)
      expect(fieldsOf(response)).toEqual(['parentId'])
    })

    it('refuses a group that is its own parent', async () => {
      const geben = await createGroup('Gestão de Benefícios')

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${geben}`,
        payload: { parentId: geben },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(422)
      expect(fieldsOf(response)).toEqual(['parentId'])
    })

    it('refuses a parent that is a descendant, which would close a cycle', async () => {
      const geben = await createGroup('Gestão de Benefícios')
      const pod = await createGroup('POD 3', geben)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${geben}`,
        payload: { parentId: pod },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(422)
      expect(fieldsOf(response)).toEqual(['parentId'])
    })

    it('accepts a subtime, which is the third and last level', async () => {
      const geben = await createGroup('Gestão de Benefícios')
      const pod = await createGroup('POD 3', geben)

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Subtime', parentId: pod },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
    })

    it('refuses a fourth level', async () => {
      const geben = await createGroup('Gestão de Benefícios')
      const pod = await createGroup('POD 3', geben)
      const subtime = await createGroup('Subtime', pod)

      const response = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Fundo do poço', parentId: subtime },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(422)
      expect(fieldsOf(response)).toEqual(['parentId'])
    })

    it('refuses a move that pushes the children of the moved group past the limit', async () => {
      const geben = await createGroup('Gestão de Benefícios')
      const pod3 = await createGroup('POD 3', geben)
      const pod5 = await createGroup('POD 5', geben)
      await createGroup('Subtime', pod3)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${pod3}`,
        payload: { parentId: pod5 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(422)
      expect(fieldsOf(response)).toEqual(['parentId'])
    })

    it('refuses to detach a pod while the root is another group', async () => {
      const geben = await createGroup('Gestão de Benefícios')
      const pod = await createGroup('POD 3', geben)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${pod}`,
        payload: { parentId: null },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(422)
      expect(fieldsOf(response)).toEqual(['parentId'])
    })

    it('accepts detaching the group that already is the root', async () => {
      const geben = await createGroup('Gestão de Benefícios')

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${geben}`,
        payload: { parentId: null },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().parentId).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  describe('DELETE /api/groups/:id', () => {
    it('returns 401 without session cookie', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${NONEXISTENT_ID}`,
      })
      expect(response.statusCode).toBe(401)
    })

    it('deletes group and returns 204', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Para Deletar' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id } = created.json()

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${id}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      expect(deleteResponse.statusCode).toBe(204)

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/groups/${id}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      expect(getResponse.statusCode).toBe(404)
    })

    it('returns 404 for non-existent group', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${NONEXISTENT_ID}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 409 when group still has members', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Com Membros' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id } = created.json()

      await app.inject({
        method: 'POST',
        url: `/api/groups/${id}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${id}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(409)
    })
  })

  // ---------------------------------------------------------------------------
  describe('POST /api/groups/:id/members', () => {
    it('returns 401 without session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${NONEXISTENT_ID}/members`,
        payload: { userId: USER_ID_1 },
      })
      expect(response.statusCode).toBe(401)
    })

    it('adds a member to a group and returns 201', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.groupId).toBe(groupId)
      expect(body.userId).toBe(USER_ID_1)
      expect(body.active).toBe(true)
    })

    it('gives a new member the role of member, which is the analyst of the pod', async () => {
      const groupId = await createGroup('POD 3')

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().role).toBe('member')
    })

    it('adds a member as admin, which is the coordination of the pod', async () => {
      const groupId = await createGroup('POD 3')

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1, role: 'admin' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().role).toBe('admin')
    })

    it('returns 400 for a role outside admin and member', async () => {
      const groupId = await createGroup('POD 3')

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1, role: 'coordenacao' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 409 when adding duplicate member', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(409)
    })

    it('returns 404 for non-existent group', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${NONEXISTENT_ID}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('accepts an e-mail as userId, the way the rest of the system identifies people', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: 'ana@pipo.health' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().userId).toBe('ana@pipo.health')
    })

    it('returns 400 for an empty userId', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: '' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 for a whitespace-only userId', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: '   ' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 for a userId longer than 255 characters', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      const response = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: 'a'.repeat(256) },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  // ---------------------------------------------------------------------------
  describe('DELETE /api/groups/:id/members/:memberId', () => {
    it('returns 401 without session cookie', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${NONEXISTENT_ID}/members/${USER_ID_1}`,
      })
      expect(response.statusCode).toBe(401)
    })

    it('removes a member and returns 204', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${groupId}/members/${USER_ID_1}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(204)
    })

    it('returns 404 when member does not exist', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${groupId}/members/${USER_ID_1}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    /** Two forms because both are correct: `@` is legal raw in a path segment,
     *  and a client that percent-encodes it must reach the same member. */
    it.each([
      ['raw', (email: string) => email],
      ['percent-encoded', (email: string) => encodeURIComponent(email)],
    ])('removes a member whose id is an e-mail, %s in the path', async (_form, encode) => {
      const email = 'ana@pipo.health'
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()
      await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: email },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${groupId}/members/${encode(email)}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(204)
    })

    /** The router's default `maxParamLength` of 100 answered 414 here, for a
     *  member the POST had just accepted. */
    it('removes a member whose id is 255 characters long, the most the POST accepts', async () => {
      const longId = 'a'.repeat(255)
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()
      const added = await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: longId },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      expect(added.statusCode).toBe(201)

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${groupId}/members/${longId}`,
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(204)
    })
  })

  // ---------------------------------------------------------------------------
  describe('PATCH /api/groups/:id/members/:memberId', () => {
    it('returns 401 without session cookie', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${NONEXISTENT_ID}/members/${USER_ID_1}`,
        payload: { active: false },
      })
      expect(response.statusCode).toBe(401)
    })

    it('updates member active status', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${groupId}/members/${USER_ID_1}`,
        payload: { active: false },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().active).toBe(false)
      expect(response.json().userId).toBe(USER_ID_1)
    })

    it('returns 400 for unknown field (strict schema)', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${groupId}/members/${USER_ID_1}`,
        payload: { active: false, campoInexistente: 'valor' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 404 when member does not exist', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/groups',
        payload: { name: 'Grupo' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })
      const { id: groupId } = created.json()

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${groupId}/members/${USER_ID_1}`,
        payload: { active: false },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(404)
    })

    it('promotes a member to admin without touching the active flag', async () => {
      const groupId = await createGroup('POD 3')
      await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${groupId}/members/${USER_ID_1}`,
        payload: { role: 'admin' },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.role).toBe('admin')
      expect(body.active).toBe(true)
    })

    it('returns 400 for an empty body, which would be an update that updates nothing', async () => {
      const groupId = await createGroup('POD 3')
      await app.inject({
        method: 'POST',
        url: `/api/groups/${groupId}/members`,
        payload: { userId: USER_ID_1 },
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${groupId}/members/${USER_ID_1}`,
        payload: {},
        cookies: { [SESSION_COOKIE_NAME]: sessionCookie },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('the structure policy', () => {
    let withoutPolicy: string
    let withTicketPolicy: string
    let withWholeProduct: string

    beforeAll(async () => {
      const anonymous = await app.inject({
        method: 'POST',
        url: '/api/auth/dev-login',
        payload: { policies: [] },
      })
      withoutPolicy = cookieValue(anonymous, SESSION_COOKIE_NAME)!

      const ticketOnly = await app.inject({
        method: 'POST',
        url: '/api/auth/dev-login',
        payload: { policies: ['admin/allow/administrate/pipodesk/ticket'] },
      })
      withTicketPolicy = cookieValue(ticketOnly, SESSION_COOKIE_NAME)!

      const wholeProduct = await app.inject({
        method: 'POST',
        url: '/api/auth/dev-login',
        payload: { policies: ['admin/allow/administrate/pipodesk/*'] },
      })
      withWholeProduct = cookieValue(wholeProduct, SESSION_COOKIE_NAME)!
    })

    const routes: Array<[string, string]> = [
      ['GET', '/api/groups'],
      ['POST', '/api/groups'],
      ['GET', '/api/groups/:id'],
      ['PATCH', '/api/groups/:id'],
      ['DELETE', '/api/groups/:id'],
      ['POST', '/api/groups/:id/members'],
      ['PATCH', '/api/groups/:id/members/:memberId'],
      ['DELETE', '/api/groups/:id/members/:memberId'],
    ]

    // Ids that do not exist are enough: the policy closes before the lookup.
    it.each(routes)('answers 403 on %s %s for a session with no policy', async (method, url) => {
      const response = await app.inject({
        method: method as 'GET',
        url: url.replace(':id', NONEXISTENT_ID).replace(':memberId', USER_ID_1),
        cookies: { [SESSION_COOKIE_NAME]: withoutPolicy },
        payload: method === 'GET' || method === 'DELETE' ? undefined : { name: 'Grupo' },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('ForbiddenError')
    })

    // The wildcard only ever matches on the session side (see policy.test.ts).
    it('opens the route for a session holding the whole product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups',
        cookies: { [SESSION_COOKIE_NAME]: withWholeProduct },
      })

      expect(response.statusCode).toBe(200)
    })

    it('answers 403 for a session holding only the ticket policy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups',
        cookies: { [SESSION_COOKIE_NAME]: withTicketPolicy },
      })

      expect(response.statusCode).toBe(403)
    })
  })
})
