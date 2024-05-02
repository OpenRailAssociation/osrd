#!/usr/bin/env python3

"""
A script that checks editoast's utoipa usage according to our conventions.

- Detects the following issues:
    - A schema has been declared in the schemas! macro but the type is not defined in the file.
    - A schema has been defined in the file and is referenced in the OpenApi, but not declared in the schemas! macro.
- Detects schemas that should be inlined that are not.
- Detects schemas that should not be declared in the OpenApi.
- Suggests a schema! declaration for each problematic file (which should be reviewed because it may contain more items
    than wanted as some schemas may be inlined).
- The script doesn't detect that a schema is meant to always be inlined so the schema! suggestion may not be 100% accurate
    and some failures may be unreported.
"""

import re
from sys import argv
from pathlib import Path
from collections import defaultdict

MULTILINE_SCHEMAS = re.compile(r"^(editoast_common::|crate::)?schemas! {$")
SINGLE_LINE_SCHEMAS = re.compile(
    r"^(editoast_common::|crate::)?schemas! {(?P<schemas>.*)}$"
)
SCHEMA_IDENT = re.compile(r"\s*(?P<ident>[A-Z][a-zA-Z0-9]+)\s*")


def scan_declared_schemas(source: str) -> set[str]:
    decl_schemas: set[str] = set()
    lines = iter(source.splitlines())
    for line in lines:
        if match := SINGLE_LINE_SCHEMAS.match(line):
            for schema in match.group("schemas").split(","):
                if match := SCHEMA_IDENT.match(schema):
                    decl_schemas.add(match.group("ident"))
            break
        if MULTILINE_SCHEMAS.match(line):
            for line in lines:
                for schema in line.split(","):
                    if match := SCHEMA_IDENT.match(schema):
                        decl_schemas.add(match.group("ident"))
                if "}" in line:
                    break
            break
    return decl_schemas


IMPL_TO_SCHEMA = re.compile(r"^impl.*ToSchema.*for (?P<ident>[A-Z][a-zA-Z0-9]+)")
STRUCT_DECL = re.compile(r".*struct (?P<ident>[A-Z][a-zA-Z0-9]+).*")
ENUM_DECL = re.compile(r".*enum (?P<ident>[A-Z][a-zA-Z0-9]+).*")


def scan_implemented_schemas(source: str) -> set[str]:
    schemas = set()
    lines = iter(source.splitlines())

    def find_next_type_name():
        for line in lines:
            if match := (STRUCT_DECL.match(line) or ENUM_DECL.match(line)):
                return match.group("ident")
        raise RuntimeError(
            f"#[derive(ToSchema)] annotation found but no struct or enum declaration found in the following lines."
        )

    for line in lines:
        if match := IMPL_TO_SCHEMA.match(line):
            schemas.add(match.group("ident"))
        elif "#[derive(" in line and "ToSchema" in line:
            schemas.add(find_next_type_name())
        elif "#[derive(" in line and "]" not in line:
            for line in lines:
                if "ToSchema" in line:
                    schemas.add(find_next_type_name())
                    break
                if "]" in line:
                    break
    return schemas


ODDLY_DECLARED_SCHEMAS = [
    re.compile("^.*PaginatedResponse.*$")  # struct declared by a macro
]


def scan_subtree(subtree: Path) -> dict[Path, tuple[set[str], set[str]]]:
    schema_scans = {}

    for path in subtree.rglob("*.rs"):
        if path.is_dir():
            continue
        with path.open() as f:
            source = f.read()

        print("Scanning", path, "...")
        declared_schemas = scan_declared_schemas(source)  # from schema!
        implemented_schemas = scan_implemented_schemas(source)  # types in the file
        if odd_schemas := {
            schema
            for schema in declared_schemas
            if any(regex.match(schema) for regex in ODDLY_DECLARED_SCHEMAS)
        }:
            implemented_schemas |= odd_schemas
        schema_scans[path] = (declared_schemas, implemented_schemas)

    return schema_scans


OPENAPI_REF = re.compile(r".*#/components/schemas/(?P<ident>[A-Z][a-zA-Z0-9]+).*")


def scan_openapi(openapi: Path) -> dict[str, int]:
    refs = defaultdict(lambda: 0)
    print("Scanning", openapi, "...")
    with openapi.open() as f:
        for line in f:
            if match := OPENAPI_REF.match(line):
                refs[match.group("ident")] += 1
    return refs


def schema_decl(schemas: set[str], openapi_refs: set[str]) -> str:
    lines = []
    for schema in sorted(schemas):
        lines.append(f"\t    {schema},")
        if schema not in openapi_refs:
            lines[
                -1
            ] += "  // not referenced in OpenAPI, schema may be inlined, consider removing this line"
    return "\teditoast_common::schemas! {{\n{}\n\t}}".format(
        "\n".join(f"\t    {schema}" for schema in lines)
    )


SHOULD_BE_INLINED = {"NonBlankString"}
SHOULD_NOT_BE_DECLARED = {"PaginatedResponse", "Identifier", "PositiveDuration"}


def check_scans(
    scans: dict[Path, tuple[set[str], set[str]]], refs: dict[str, int]
) -> int:
    n = 0
    openapi_refs = set(refs.keys())
    if extra := openapi_refs & SHOULD_NOT_BE_DECLARED:
        n += 1
        print("In openapi.yaml:")
        print(f"* The following schemas are wrongfully referenced:", sorted(extra))
    for path, (declared, implemented) in scans.items():
        missing = (implemented - declared) & openapi_refs
        extra = declared - implemented
        # NOTE: We probably don't want to force the inlining of all schemas that are only used once.
        # For example, we may still want a RollingStockCreateForm, even if it's only used in the
        # POST endpoint and nowhere else.
        # But if we were to want it, we could do:
        # should_be_inlined |= {schema for schema in declared if refs.get(schema) == 1}
        should_be_inlined = declared & SHOULD_BE_INLINED
        expected_declarations = implemented - SHOULD_BE_INLINED
        if missing or extra or should_be_inlined:
            n += 1
            print(f"In file {path}:")
            if missing:
                # We only consider a schema as missing if it's actually referenced in the OpenAPI file.
                # In other words #[schema(inline)] structs are not considered missing.
                print("* Missing schema declarations:", sorted(missing))
            if extra:
                print(
                    "* Schemas that shouldn't be declared in this file:", sorted(extra)
                )
            if should_be_inlined:
                print(
                    "* Schemas that should be inlined using #[schema(inline)]:",
                    sorted(should_be_inlined),
                )
        if (
            missing
            or extra
            or should_be_inlined
            or (not expected_declarations and declared)
        ):
            if expected_declarations:
                print("* Schema declaration list should be:")
                print(schema_decl(expected_declarations, openapi_refs))
            else:
                print("* No schema! declaration is expected in in this file.")
            print()
    return n


def main():
    if len(argv) < 3:
        print(f"Usage: {argv[0]} OPENAPI_FILE DIRECTORY...")
        exit(1)

    refs = scan_openapi(Path(argv[1]))

    scans = {}
    for subtree in argv[2:]:
        scans.update(scan_subtree(Path(subtree)))
    print()

    if n := check_scans(scans, refs):
        print(f"Found {n} files with schema declaration issues.")
        exit(2)
    else:
        exit(0)


if __name__ == "__main__":
    main()
