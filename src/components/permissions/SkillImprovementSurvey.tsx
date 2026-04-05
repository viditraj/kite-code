/**
 * SkillImprovementSurvey — Feedback dialog for skill quality.
 *
 * Shows a 1-5 star rating with optional text feedback.
 * Uses number keys 1-5 for quick rating, Enter to submit,
 * Escape to dismiss.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

// ============================================================================
// Types
// ============================================================================

export interface SkillImprovementSurveyProps {
  skillName: string
  onSubmit: (rating: number, feedback: string) => void
  onDismiss: () => void
  isActive?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const STAR_FILLED = '\u2605'   // ★
const STAR_EMPTY = '\u2606'    // ☆
const MAX_STARS = 5

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
}

const RATING_COLORS: Record<number, string> = {
  1: 'red',
  2: 'red',
  3: 'yellow',
  4: 'green',
  5: 'green',
}

// ============================================================================
// SkillImprovementSurvey Component
// ============================================================================

export const SkillImprovementSurvey: React.FC<SkillImprovementSurveyProps> = ({
  skillName,
  onSubmit,
  onDismiss,
  isActive = true,
}) => {
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [feedbackMode, setFeedbackMode] = useState(false)

  useInput((inputStr, key) => {
    if (!isActive) return

    // Escape to dismiss
    if (key.escape) {
      if (feedbackMode) {
        setFeedbackMode(false)
      } else {
        onDismiss()
      }
      return
    }

    // In feedback text entry mode
    if (feedbackMode) {
      if (key.return) {
        // Submit when pressing Enter in feedback mode
        if (rating > 0) {
          onSubmit(rating, feedback)
        }
        return
      }
      if (key.backspace || key.delete) {
        setFeedback((prev) => prev.slice(0, -1))
        return
      }
      // Append printable characters
      if (inputStr && !key.ctrl && !key.meta) {
        setFeedback((prev) => prev + inputStr)
      }
      return
    }

    // Number keys 1-5 for rating
    const num = parseInt(inputStr, 10)
    if (num >= 1 && num <= MAX_STARS) {
      setRating(num)
      return
    }

    // Left/right to adjust rating
    if (key.leftArrow && rating > 1) {
      setRating((prev) => Math.max(1, prev - 1))
      return
    }
    if (key.rightArrow && rating < MAX_STARS) {
      setRating((prev) => Math.min(MAX_STARS, prev + 1))
      return
    }

    // Tab to enter feedback mode
    if (key.tab && rating > 0) {
      setFeedbackMode(true)
      return
    }

    // Enter to submit (or enter feedback mode if no feedback yet)
    if (key.return && rating > 0) {
      if (!feedbackMode && !feedback) {
        setFeedbackMode(true)
      } else {
        onSubmit(rating, feedback)
      }
      return
    }
  }, { isActive })

  // Build star display
  const stars = Array.from({ length: MAX_STARS }, (_, i) => {
    const filled = i < rating
    const color = rating > 0 ? RATING_COLORS[rating] : undefined
    return (
      <Text key={i} color={color} bold={filled}>
        {filled ? STAR_FILLED : STAR_EMPTY}
      </Text>
    )
  })

  const ratingLabel = rating > 0 ? RATING_LABELS[rating] : ''
  const ratingColor = rating > 0 ? RATING_COLORS[rating] : undefined

  return (
    <Box flexDirection="column">
      {/* Top separator */}
      <Text color="cyan">{'\u2500'.repeat(60)}</Text>

      {/* Header */}
      <Box>
        <Text color="cyan" bold>{'\u2728 '}</Text>
        <Text bold>How was the skill: </Text>
        <Text color="cyan" bold>{skillName}</Text>
        <Text bold>?</Text>
      </Box>

      {/* Rating stars */}
      <Box marginLeft={2} marginTop={1}>
        <Text dimColor>Rating: </Text>
        {stars}
        {rating > 0 && (
          <Text color={ratingColor}>{' '}{ratingLabel}</Text>
        )}
      </Box>

      {/* Instructions for rating */}
      {rating === 0 && (
        <Box marginLeft={2}>
          <Text dimColor>Press 1-5 or use arrow keys to rate</Text>
        </Box>
      )}

      {/* Feedback area */}
      {rating > 0 && (
        <Box marginLeft={2} marginTop={1} flexDirection="column">
          <Text dimColor>Feedback (optional — Tab to edit, Enter to submit):</Text>
          <Box
            borderStyle={feedbackMode ? 'round' : 'single'}
            borderColor={feedbackMode ? 'cyan' : 'gray'}
            paddingX={1}
          >
            <Text>
              {feedback || (feedbackMode ? '\u2588' : '')}
              {feedbackMode && feedback ? '\u2588' : ''}
            </Text>
          </Box>
        </Box>
      )}

      {/* Action hints */}
      <Box marginLeft={2} marginTop={1}>
        <Text dimColor>
          {rating > 0 ? 'Enter: submit' : ''}
          {rating > 0 ? ' \u2022 ' : ''}
          {'Esc: dismiss'}
        </Text>
      </Box>

      {/* Bottom separator */}
      <Text color="cyan">{'\u2500'.repeat(60)}</Text>
    </Box>
  )
}

export default SkillImprovementSurvey
