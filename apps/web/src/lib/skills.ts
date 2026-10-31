// The catalog itself lives in @clawdhq/custody-core's separate "skill-catalog" subpath export
// (skillCatalog.ts) — hosted-agent-runtime needs these descriptions too, to tell an LLM what an
// installed skill actually is, and can't import from apps/web (wrong dependency direction). A
// *separate* subpath, not the package's main barrel: this catalog is pure data, safe for a
// browser bundle (useSkills.ts is "use client"), unlike custody-core's main export surface,
// which pulls in Node-only built-ins. Re-exported here under the app's existing import path so
// nothing in the UI needs to change.
export { type Skill, SKILL_CATEGORIES, BUILTIN_SKILLS } from "@clawdhq/custody-core/skill-catalog";
