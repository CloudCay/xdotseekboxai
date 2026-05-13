import { createFileRoute } from '@tanstack/react-router'
import { MatrixLab } from '../../components/xIntel/XIntelTools'

export const Route = createFileRoute('/labs/matrix')({
  head: () => ({
    meta: [{ title: 'Matrix — X.SeekBoxAI Intel' }],
  }),
  component: MatrixLab,
})
