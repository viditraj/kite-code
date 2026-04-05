/**
 * SkillImprovementSurvey — Feedback dialog for skill quality.
 *
 * Shows a 1-5 star rating with optional text feedback.
 * Uses number keys 1-5 for quick rating, Enter to submit,
 * Escape to dismiss.
 */
import React from 'react';
export interface SkillImprovementSurveyProps {
    skillName: string;
    onSubmit: (rating: number, feedback: string) => void;
    onDismiss: () => void;
    isActive?: boolean;
}
export declare const SkillImprovementSurvey: React.FC<SkillImprovementSurveyProps>;
export default SkillImprovementSurvey;
//# sourceMappingURL=SkillImprovementSurvey.d.ts.map