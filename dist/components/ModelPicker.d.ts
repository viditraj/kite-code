/**
 * ModelPicker — Rich model selector with provider grouping and search.
 *
 * Displays models grouped by provider with color-coded labels.
 * Supports arrow-key navigation, Enter to select, Esc to cancel,
 * and type-ahead filtering.
 */
import React from 'react';
export interface ModelInfo {
    name: string;
    provider: string;
    description?: string;
}
export interface ModelPickerProps {
    /** Available models to choose from. */
    models: ModelInfo[];
    /** Currently active model name. */
    currentModel: string;
    /** Called when the user selects a model. */
    onSelect: (model: ModelInfo) => void;
    /** Called when the user cancels (Esc). */
    onCancel: () => void;
    /** Whether this component receives keyboard input. */
    isActive?: boolean;
}
export declare function ModelPicker({ models, currentModel, onSelect, onCancel, isActive, }: ModelPickerProps): React.ReactElement;
//# sourceMappingURL=ModelPicker.d.ts.map