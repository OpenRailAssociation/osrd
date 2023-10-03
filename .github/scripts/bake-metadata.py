#!/usr/bin/env python3
"""
Generates a bake for multiple containers, given tags and labels
as produced by the docker/metadata-action action.
"""

import sys
import json

from argparse import ArgumentParser, FileType


def _parser():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument(
        "--container", dest="containers", action="append", help="input container names"
    )

    pat_doc = ", where {container} is the base container name"
    parser.add_argument(
        "--image-pattern",
        dest="image_patterns",
        action="append",
        help="output image patterns" + pat_doc,
    )
    parser.add_argument(
        "--cache-to-pattern",
        dest="cache_to_patterns",
        action="append",
        help="cache-to target patterns" + pat_doc,
    )
    parser.add_argument(
        "--cache-from-pattern",
        dest="cache_from_patterns",
        action="append",
        help="cache-from target patterns" + pat_doc,
    )
    parser.add_argument("target_pattern", help="output target name pattern" + pat_doc)
    parser.add_argument(
        "input_metadata",
        type=FileType("r"),
        help="tags and labels Json file input, as produced by docker/metadata-action",
    )
    return parser


def container_tags(container, image_patterns, input_tags):
    """Make a list of tags to apply to a container"""
    container_images = (pat.format(container=container) for pat in image_patterns)
    return [f"{image}:{tag}" for image in container_images for tag in input_tags]


def generate_bake_file(
    input_metadata,
    containers,
    target_pattern,
    image_patterns,
    cache_to_patterns,
    cache_from_patterns,
):
    input_labels = input_metadata["labels"]
    input_tags = [tag.split(":")[1] for tag in input_metadata["tags"]]

    bake_targets = {}
    for container in containers:
        target_manifest = {
            "tags": container_tags(container, image_patterns, input_tags),
            "labels": input_labels,
        }

        if cache_to_patterns:
            target_manifest["cache-to"] = [
                pat.format(container=container) for pat in cache_to_patterns
            ]

        if cache_from_patterns:
            target_manifest["cache-from"] = [
                pat.format(container=container) for pat in cache_from_patterns
            ]

        target = target_pattern.format(container=container)
        bake_targets[target] = target_manifest

    return {"target": bake_targets}


def main(args=None):
    args = _parser().parse_args(args)
    input_metadata = json.load(args.input_metadata)
    bake_file = generate_bake_file(
        input_metadata,
        args.containers,
        args.target_pattern,
        args.image_patterns,
        args.cache_to_patterns,
        args.cache_from_patterns,
    )
    json.dump(bake_file, sys.stdout)


if __name__ == "__main__":
    main()
