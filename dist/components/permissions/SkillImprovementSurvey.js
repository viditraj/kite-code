import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SkillImprovementSurvey — Feedback dialog for skill quality.
 *
 * Shows a 1-5 star rating with optional text feedback.
 * Uses number keys 1-5 for quick rating, Enter to submit,
 * Escape to dismiss.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
// ============================================================================
// Constants
// ============================================================================
const STAR_FILLED = '\u2605'; // ★
const STAR_EMPTY = '\u2606'; // ☆
const MAX_STARS = 5;
const RATING_LABELS = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very good',
    5: 'Excellent',
};
const RATING_COLORS = {
    1: 'red',
    2: 'red',
    3: 'yellow',
    4: 'green',
    5: 'green',
};
// ============================================================================
// SkillImprovementSurvey Component
// ============================================================================
export const SkillImprovementSurvey = ({ skillName, onSubmit, onDismiss, isActive = true, }) => {
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [feedbackMode, setFeedbackMode] = useState(false);
    useInput((inputStr, key) => {
        if (!isActive)
            return;
        // Escape to dismiss
        if (key.escape) {
            if (feedbackMode) {
                setFeedbackMode(false);
            }
            else {
                onDismiss();
            }
            return;
        }
        // In feedback text entry mode
        if (feedbackMode) {
            if (key.return) {
                // Submit when pressing Enter in feedback mode
                if (rating > 0) {
                    onSubmit(rating, feedback);
                }
                return;
            }
            if (key.backspace || key.delete) {
                setFeedback((prev) => prev.slice(0, -1));
                return;
            }
            // Append printable characters
            if (inputStr && !key.ctrl && !key.meta) {
                setFeedback((prev) => prev + inputStr);
            }
            return;
        }
        // Number keys 1-5 for rating
        const num = parseInt(inputStr, 10);
        if (num >= 1 && num <= MAX_STARS) {
            setRating(num);
            return;
        }
        // Left/right to adjust rating
        if (key.leftArrow && rating > 1) {
            setRating((prev) => Math.max(1, prev - 1));
            return;
        }
        if (key.rightArrow && rating < MAX_STARS) {
            setRating((prev) => Math.min(MAX_STARS, prev + 1));
            return;
        }
        // Tab to enter feedback mode
        if (key.tab && rating > 0) {
            setFeedbackMode(true);
            return;
        }
        // Enter to submit (or enter feedback mode if no feedback yet)
        if (key.return && rating > 0) {
            if (!feedbackMode && !feedback) {
                setFeedbackMode(true);
            }
            else {
                onSubmit(rating, feedback);
            }
            return;
        }
    }, { isActive });
    // Build star display
    const stars = Array.from({ length: MAX_STARS }, (_, i) => {
        const filled = i < rating;
        const color = rating > 0 ? RATING_COLORS[rating] : undefined;
        return (_jsx(Text, { color: color, bold: filled, children: filled ? STAR_FILLED : STAR_EMPTY }, i));
    });
    const ratingLabel = rating > 0 ? RATING_LABELS[rating] : '';
    const ratingColor = rating > 0 ? RATING_COLORS[rating] : undefined;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "cyan", children: '\u2500'.repeat(60) }), _jsxs(Box, { children: [_jsx(Text, { color: "cyan", bold: true, children: '\u2728 ' }), _jsx(Text, { bold: true, children: "How was the skill: " }), _jsx(Text, { color: "cyan", bold: true, children: skillName }), _jsx(Text, { bold: true, children: "?" })] }), _jsxs(Box, { marginLeft: 2, marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "Rating: " }), stars, rating > 0 && (_jsxs(Text, { color: ratingColor, children: [' ', ratingLabel] }))] }), rating === 0 && (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { dimColor: true, children: "Press 1-5 or use arrow keys to rate" }) })), rating > 0 && (_jsxs(Box, { marginLeft: 2, marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Feedback (optional \u2014 Tab to edit, Enter to submit):" }), _jsx(Box, { borderStyle: feedbackMode ? 'round' : 'single', borderColor: feedbackMode ? 'cyan' : 'gray', paddingX: 1, children: _jsxs(Text, { children: [feedback || (feedbackMode ? '\u2588' : ''), feedbackMode && feedback ? '\u2588' : ''] }) })] })), _jsx(Box, { marginLeft: 2, marginTop: 1, children: _jsxs(Text, { dimColor: true, children: [rating > 0 ? 'Enter: submit' : '', rating > 0 ? ' \u2022 ' : '', 'Esc: dismiss'] }) }), _jsx(Text, { color: "cyan", children: '\u2500'.repeat(60) })] }));
};
export default SkillImprovementSurvey;
//# sourceMappingURL=SkillImprovementSurvey.js.map