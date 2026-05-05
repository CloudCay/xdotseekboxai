import React, { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/cleanseek')({
  component: CleanSeekRedirect,
})

function CleanSeekRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate({ to: '/cleanseek-x' })
  }, [navigate])
  return null
}

