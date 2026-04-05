/**
 * Skill loading from directory structure.
 *
 * Scans .kite/skills/ and .claude/skills/ directories at project and user level,
 * parsing SKILL.md files into PromptCommand objects that can be invoked as
 * slash commands. Supports frontmatter metadata, argument substitution,
 * and runtime skill registration.
 */
import type { Command } from '../types/command.js';
export interface SkillMetadata {
    name: string;
    description: string;
    arguments?: string[];
    allowedTools?: string[];
    model?: string;
    context?: 'inline' | 'fork';
    agent?: string;
    paths?: string[];
    hooks?: Record<string, unknown>;
    skillRoot: string;
    source: string;
}
/**
 * Parse YAML-like frontmatter from a markdown file.
 *
 * Looks for `---` at the start of the content, finds the closing `---`,
 * and parses key: value pairs between them. Handles multi-line values
 * where continuation lines are indented. If no frontmatter block is found,
 * returns an empty map and the full content as body.
 */
export declare function parseFrontmatter(content: string): {
    frontmatter: Record<string, string>;
    body: string;
};
/**
 * Parse a SKILL.md file into SkillMetadata.
 *
 * Reads the file, extracts frontmatter, and parses all supported metadata
 * fields. Argument names are extracted from `$ARGUMENTS` usage or `{{arg}}`
 * patterns in the body.
 *
 * @param filePath - Absolute path to the SKILL.md file
 * @param source - Source label (e.g. 'project', 'user')
 * @returns SkillMetadata or null if the file cannot be parsed
 */
export declare function parseSkillFile(filePath: string, source: string): SkillMetadata | null;
/**
 * Load a single skill from a directory containing a SKILL.md file.
 *
 * @param skillDir - Path to the skill directory
 * @param source - Source label for the command
 * @returns A Command (PromptCommand) or null if the directory is not a valid skill
 */
export declare function loadSkillFromDir(skillDir: string, source: string): Command | null;
/**
 * Return the skills directory path for a given source scope.
 *
 * @param source - 'project' uses cwd, 'user' and 'global' use home directory
 * @returns Absolute path to the skills directory
 */
export declare function getSkillsPath(source: 'project' | 'user' | 'global'): string;
/**
 * Scan a directory for skill subdirectories.
 *
 * Each subdirectory that contains a SKILL.md file is treated as a skill.
 * Non-directory entries and directories without SKILL.md are silently skipped.
 *
 * @param dir - Directory to scan
 * @param source - Source label for loaded commands
 * @returns Array of Command objects for discovered skills
 */
export declare function scanSkillsDirectory(dir: string, source: string): Command[];
/**
 * Load all skills from all source directories.
 *
 * Scans project-level directories first (.kite/skills/ and .claude/skills/
 * relative to cwd), then user-level (~/.kite/skills/). Project skills take
 * precedence over user skills when names collide.
 *
 * @param cwd - Current working directory (project root)
 * @returns Deduplicated array of skill commands
 */
export declare function getSkillDirCommands(cwd: string): Command[];
/**
 * Clear all memoized skill data.
 *
 * Called when the skill directories may have changed (e.g. after a file
 * write to a skills directory).
 */
export declare function clearSkillCaches(): void;
/**
 * Return dynamically discovered skills.
 *
 * Dynamic skills are registered at runtime when the system discovers SKILL.md
 * files during file operations (e.g. glob, grep, file read). They supplement
 * the directory-scanned skills.
 *
 * @returns Array of dynamically registered skill commands
 */
export declare function getDynamicSkills(): Command[];
/**
 * Register a skill discovered during runtime.
 *
 * Prevents duplicate registration by checking the command name against
 * already-registered dynamic skills.
 *
 * @param command - The Command to register as a dynamic skill
 */
export declare function registerDynamicSkill(command: Command): void;
//# sourceMappingURL=loadSkillsDir.d.ts.map