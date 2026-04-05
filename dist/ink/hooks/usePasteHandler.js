/**
 * usePasteHandler — handle paste events in the terminal.
 *
 * Adapted from Claude Code's usePasteHandler.ts for Kite.
 * Detects paste events by monitoring input length (terminal pastes
 * deliver many characters at once vs. single keystrokes). Aggregates
 * chunked paste data and delivers a single paste event.
 *
 * Also handles image file path detection in pasted content.
 */
import { useCallback, useRef, useState } from 'react';
/** Number of characters that indicates a paste rather than typing */
const PASTE_THRESHOLD = 6;
/** Time to wait for more paste chunks before committing */
const PASTE_COMPLETION_TIMEOUT_MS = 100;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico'];
function isImageFilePath(text) {
    const trimmed = text.trim().toLowerCase();
    return IMAGE_EXTENSIONS.some(ext => trimmed.endsWith(ext));
}
export function usePasteHandler({ onPaste, onInput, onImagePath, }) {
    const [pasteState, setPasteState] = useState({
        chunks: [],
        timeoutId: null,
    });
    const [isPasting, setIsPasting] = useState(false);
    const pastePendingRef = useRef(false);
    const resetPasteTimeout = useCallback((currentTimeoutId) => {
        if (currentTimeoutId) {
            clearTimeout(currentTimeoutId);
        }
        return setTimeout(() => {
            pastePendingRef.current = false;
            setPasteState(({ chunks }) => {
                const pastedText = chunks.join('');
                // Check for image file paths in pasted content
                if (onImagePath) {
                    const lines = pastedText.split('\n').filter(l => l.trim());
                    const imagePaths = lines.filter(line => isImageFilePath(line));
                    for (const imgPath of imagePaths) {
                        onImagePath(imgPath.trim());
                    }
                    // Only pass non-image text to onPaste
                    const nonImageLines = lines.filter(line => !isImageFilePath(line));
                    if (nonImageLines.length > 0 && onPaste) {
                        onPaste(nonImageLines.join('\n'));
                    }
                }
                else if (onPaste) {
                    onPaste(pastedText);
                }
                setIsPasting(false);
                return { chunks: [], timeoutId: null };
            });
        }, PASTE_COMPLETION_TIMEOUT_MS);
    }, [onPaste, onImagePath]);
    const wrappedOnInput = useCallback((input, key) => {
        // Check for image file paths
        const hasImageFilePath = input
            .split('\n')
            .some(line => isImageFilePath(line.trim()));
        // Detect paste: large input chunk, continuation of paste, or image path
        const shouldHandleAsPaste = onPaste &&
            (input.length > PASTE_THRESHOLD ||
                pastePendingRef.current ||
                hasImageFilePath);
        if (shouldHandleAsPaste) {
            pastePendingRef.current = true;
            setIsPasting(true);
            setPasteState(({ chunks, timeoutId }) => {
                return {
                    chunks: [...chunks, input],
                    timeoutId: resetPasteTimeout(timeoutId),
                };
            });
            return;
        }
        onInput(input, key);
    }, [onPaste, onInput, resetPasteTimeout]);
    return {
        wrappedOnInput,
        pasteState,
        isPasting,
    };
}
//# sourceMappingURL=usePasteHandler.js.map