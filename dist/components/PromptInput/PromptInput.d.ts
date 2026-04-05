import React from 'react';
export interface PromptInputProps {
    onSubmit: (value: string) => void;
    placeholder?: string;
    prefix?: string;
    isActive?: boolean;
    history?: string[];
    multiLine?: boolean;
}
export declare function PromptInput({ onSubmit, placeholder, prefix, isActive, history, multiLine, }: PromptInputProps): React.ReactElement;
//# sourceMappingURL=PromptInput.d.ts.map