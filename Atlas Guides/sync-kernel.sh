#!/usr/bin/env bash
# Atlas Guides — Sync Script
# Copies kernel.md and slash commands to whichever filenames each AI tool reads from.
# Edit the Atlas Guides files, run this script, all tools update.

set -euo pipefail

# Locate the Atlas Guides folder. The script lives inside it.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KERNEL="${SCRIPT_DIR}/kernel.md"
COMMANDS_DIR="${SCRIPT_DIR}/commands"

# Project root is one level up from atlas-guides folder, unless atlas-guides
# is already the project root.
if [[ -f "${SCRIPT_DIR}/../spec.md" ]] || [[ -d "${SCRIPT_DIR}/../.git" ]] || [[ -f "${SCRIPT_DIR}/../pyproject.toml" ]]; then
    PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
    PROJECT_ROOT="${SCRIPT_DIR}"
fi

echo "Atlas Guides folder: ${SCRIPT_DIR}"
echo "Project root:        ${PROJECT_ROOT}"
echo ""

if [[ ! -f "${KERNEL}" ]]; then
    echo "ERROR: kernel.md not found at ${KERNEL}"
    exit 1
fi

# ============================================================
# Part 1: Sync kernel.md to tool-specific filenames
# ============================================================

echo "=== Syncing kernel.md ==="

declare -a KERNEL_TARGETS=(
    "CLAUDE.md"                      # Claude Code
    ".cursorrules"                   # Cursor (legacy)
    ".cursor/rules/kernel.md"        # Cursor (newer)
    ".windsurfrules"                 # Windsurf
    "CONVENTIONS.md"                 # Aider
    ".continuerules"                 # Continue.dev
    ".agents/workflows/kernel.md"    # Antigravity / Gemini CLI
)

for target in "${KERNEL_TARGETS[@]}"; do
    DEST="${PROJECT_ROOT}/${target}"
    DEST_DIR="$(dirname "${DEST}")"

    if [[ ! -d "${DEST_DIR}" ]]; then
        mkdir -p "${DEST_DIR}"
    fi

    cp "${KERNEL}" "${DEST}"
    echo "  Wrote: ${target}"
done

# ============================================================
# Part 1.5: Sync directive files to project root
# These are loaded by role boot sequences. Every tool reads
# them from the project root, so they must live there.
# ============================================================

echo ""
echo "=== Syncing directive files ==="

declare -a DIRECTIVE_FILES=(
    "fixer-directive.md"       # Fixer (Model 1) — triage, patch, verify, produce Fixer Report
    "debugger-directive.md"    # Debugger (Model 2) — 5-lens audit, approve or reject
)

MISSING_DIRECTIVES=0
for file in "${DIRECTIVE_FILES[@]}"; do
    SRC="${SCRIPT_DIR}/${file}"
    DEST="${PROJECT_ROOT}/${file}"
    if [[ ! -f "${SRC}" ]]; then
        echo "  ERROR: ${file} not found in atlas-guides/ — skipping"
        MISSING_DIRECTIVES=$((MISSING_DIRECTIVES + 1))
    else
        cp "${SRC}" "${DEST}"
        echo "  Wrote: ${file}"
    fi
done

if [[ $MISSING_DIRECTIVES -gt 0 ]]; then
    echo ""
    echo "  WARNING: ${MISSING_DIRECTIVES} directive file(s) missing from atlas-guides/."
    echo "  The /fixer and /debugger pipeline will not work correctly until they are present."
fi

# ============================================================
# Part 2: Sync slash commands to tool-specific command dirs
# ============================================================

if [[ -d "${COMMANDS_DIR}" ]]; then
    echo ""
    echo "=== Syncing slash commands ==="

    declare -a COMMAND_DIRS=(
        ".claude/commands"               # Claude Code
        ".cursor/commands"               # Cursor
        ".agents/workflows"              # Antigravity / Gemini CLI (workflows ARE commands)
    )

    # Count commands once for the summary line
    CMD_COUNT=0
    for f in "${COMMANDS_DIR}"/*.md; do
        [[ -f "$f" ]] && CMD_COUNT=$((CMD_COUNT + 1))
    done

    for cmd_dir in "${COMMAND_DIRS[@]}"; do
        DEST_DIR="${PROJECT_ROOT}/${cmd_dir}"
        mkdir -p "${DEST_DIR}"

        for cmd_file in "${COMMANDS_DIR}"/*.md; do
            cmd_name="$(basename "${cmd_file}")"
            cp "${cmd_file}" "${DEST_DIR}/${cmd_name}"
        done
        echo "  Wrote ${CMD_COUNT} commands to: ${cmd_dir}/"
    done
fi

# ============================================================
# Part 3: Ensure required project files exist
# ============================================================

echo ""
echo "=== Verifying required project files ==="

declare -a REQUIRED_FILES=(
    ".build-context.md"
    "current-loop.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "${PROJECT_ROOT}/${file}" ]]; then
        touch "${PROJECT_ROOT}/${file}"
        echo "  Created empty: ${file}"
    else
        echo "  Exists: ${file}"
    fi
done

if [[ ! -d "${PROJECT_ROOT}/docs/archive" ]]; then
    mkdir -p "${PROJECT_ROOT}/docs/archive"
    echo "  Created: docs/archive/"
fi

# Debugger ledger files — copy from atlas-guides template if not present
declare -a DEBUGGER_FILES=(
    "active-ledger.md"
    "archive-index.md"
)

for file in "${DEBUGGER_FILES[@]}"; do
    if [[ ! -f "${PROJECT_ROOT}/${file}" ]]; then
        if [[ -f "${SCRIPT_DIR}/${file}" ]]; then
            cp "${SCRIPT_DIR}/${file}" "${PROJECT_ROOT}/${file}"
            echo "  Created: ${file} (from atlas-guides template)"
        else
            touch "${PROJECT_ROOT}/${file}"
            echo "  Created empty: ${file}"
        fi
    else
        echo "  Exists: ${file}"
    fi
done

# ============================================================
# Part 4: Cleanup legacy files
# ============================================================

echo ""
echo "=== Cleaning up legacy files ==="

# Clean up old directives in project root
for file in "fixer.md" "debugger.md"; do
    LEGACY="${PROJECT_ROOT}/${file}"
    if [[ -f "${LEGACY}" ]]; then
        rm "${LEGACY}"
        echo "  Removed legacy project root file: ${file}"
    fi
done

# Clean up old commands in command directories
declare -a LEGACY_COMMANDS=("debug.md" "fix.md")
for cmd_dir in "${COMMAND_DIRS[@]}"; do
    DEST_DIR="${PROJECT_ROOT}/${cmd_dir}"
    for cmd in "${LEGACY_COMMANDS[@]}"; do
        LEGACY="${DEST_DIR}/${cmd}"
        if [[ -f "${LEGACY}" ]]; then
            rm "${LEGACY}"
            echo "  Removed legacy command from ${cmd_dir}: ${cmd}"
        fi
    done
done

# ============================================================
# Summary
# ============================================================

echo ""
echo "Sync complete."
echo ""
echo "Tools updated:"
echo "  - Claude Code  (CLAUDE.md + .claude/commands/)"
echo "  - Cursor       (.cursorrules + .cursor/rules/ + .cursor/commands/)"
echo "  - Windsurf     (.windsurfrules)"
echo "  - Aider        (CONVENTIONS.md)"
echo "  - Continue     (.continuerules)"
echo "  - Antigravity  (.agents/workflows/)"
echo ""
echo "Directive files synced to project root:"
echo "  - fixer-directive.md    (Model 1 — /fixer)"
echo "  - debugger-directive.md (Model 2 — /debugger)"
echo ""
echo "Debugger files verified:"
echo "  - active-ledger.md"
echo "  - archive-index.md"
echo ""
echo "Available slash commands:"
if [[ -d "${COMMANDS_DIR}" ]]; then
    for cmd_file in "${COMMANDS_DIR}"/*.md; do
        cmd_name="$(basename "${cmd_file}" .md)"
        echo "  /${cmd_name}"
    done
fi
echo ""
echo "If you use a tool not listed above, add its rule file path to KERNEL_TARGETS"
echo "and its command directory to COMMAND_DIRS in this script."
