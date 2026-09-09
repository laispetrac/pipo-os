import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/_desk/tickets/$id')({
  // The detail carries the record fixture (7 MB); the queue must not pay for it at boot.
  component: lazyRouteComponent(() => import('@/pages/pipodesk/ticket')),
})
