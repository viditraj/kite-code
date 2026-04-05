import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Text } from 'ink';
// ============================================================================
// FilePathLink Component
// ============================================================================
export const FilePathLink = ({ path, lineNumber }) => {
    const lastSlash = path.lastIndexOf('/');
    const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '';
    const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
    return (_jsxs(Text, { children: [dir && _jsx(Text, { color: "cyan", dimColor: true, children: dir }), _jsx(Text, { color: "cyan", bold: true, children: filename }), lineNumber !== undefined && (_jsxs(Text, { color: "cyan", dimColor: true, children: [":", lineNumber] }))] }));
};
export default FilePathLink;
//# sourceMappingURL=FilePathLink.js.map