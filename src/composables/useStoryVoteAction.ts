import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { fetchVoteActionsForItemPage, runHnProxyAction } from '../api/auth'
import type { HnItem } from '../api/types'
import { authState, isItemUpvoted, setLoading, setUpvotedItem } from '../store'

export function useStoryVoteAction() {
  const router = useRouter()
  const votingStoryId = ref<number | null>(null)

  function loginUrl() {
    return `/login?next=${encodeURIComponent(router.currentRoute.value.fullPath)}`
  }

  async function toggleStoryVote(item: HnItem | null | undefined) {
    if (!item) return

    const token = authState.token
    if (!token) {
      router.push(loginUrl())
      return
    }

    if (votingStoryId.value) return

    votingStoryId.value = item.id
    setLoading(true)

    try {
      const actions = await fetchVoteActionsForItemPage(item.id, token)
      const action = actions.find((candidate) => candidate.id === item.id)

      if (!action) {
        window.alert('No vote action is available for this story.')
        return
      }

      const nextVoted = action.how === 'up'
      await runHnProxyAction(action.href, token)
      setUpvotedItem(item.id, 'story', nextVoted)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Vote action failed')
    } finally {
      votingStoryId.value = null
      setLoading(false)
    }
  }

  function voteLabel(item: HnItem | null | undefined) {
    if (!authState.token) return 'Login to Vote'
    if (!item) return 'Vote'
    return isItemUpvoted(item.id) ? 'Unvote' : 'Upvote'
  }

  return {
    votingStoryId,
    toggleStoryVote,
    voteLabel,
  }
}
