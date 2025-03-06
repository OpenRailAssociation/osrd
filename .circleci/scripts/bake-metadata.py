#!/usr/bin/env python3
"""
Generates a bake for multiple containers, given tags and labels
as produced by the docker/metadata-action action.
"""

import os
import json
import subprocess
from dataclasses import dataclass
from typing import Optional, Union, Tuple, List
from abc import ABC, abstractmethod


DEFAULT_EDGE_NAMESPACE = "ghcr.io/openrailassociation/osrd-edge"
DEFAULT_RELEASE_NAMESPACE = "ghcr.io/openrailassociation/osrd-stable"


@dataclass
class Target:
    name: str
    image: str
    variant: Optional[str] = None
    release: bool = False

    @property
    def suffix(self):
        if self.variant is None:
            return ""
        return f"-{self.variant}"


TARGETS = [
    Target(name="core", image="core", release=True),
    Target(name="core-build", image="core", variant="build"),

    Target(name="editoast", image="editoast", release=True),
    Target(name="editoast-test", image="editoast", variant="test"),

    Target(name="front-tests", image="front", variant="tests"),

    Target(name="gateway-standalone", image="gateway", variant="standalone"),
    Target(name="gateway-test", image="gateway", variant="test"),
    Target(name="gateway-front", image="gateway", variant="front", release=True),

    Target(name="osrdyne", image="osrdyne", release=True),
    Target(name="osrdyne-test", image="osrdyne", variant="test"),
]


def short_hash(commit_hash: str) -> str:
    args = ["git", "rev-parse", "--short", commit_hash]
    res = subprocess.run(args, check=True, stdout=subprocess.PIPE)
    return res.stdout.decode().strip()


def parse_merge_commit(ref) -> Tuple[str, str]:
    args = ["git", "log", "-1", "--pretty=format:%s", ref]
    res = subprocess.run(args, check=True, stdout=subprocess.PIPE)
    merge_title = res.stdout.decode().strip()
    # expect "Merge XXX into YYY"
    merge, pr_commit, into, base_commit = merge_title.split()
    assert ("Merge", "into") == (merge, into)
    return (pr_commit, base_commit)


def registry_cache(image: str) -> str:
    return f"type=registry,mode=max,ref={image}-cache"


class BaseEvent(ABC):
    @abstractmethod
    def version_string(self) -> str:
        pass

    @abstractmethod
    def get_stable_version(self) -> str:
        pass

    def get_namespace(self) -> str:
        return DEFAULT_EDGE_NAMESPACE

    def tag(self, target: Target, version: str) -> str:
        image_name = f"{self.get_namespace()}/osrd-{target.image}"
        return f"{image_name}:{version}{target.suffix}"

    def get_stable_tag(self, target: Target) -> str:
        version = self.get_stable_version()
        return self.tag(target, version)

    def output_method(self):
        return "registry"

    def get_output(self, target: Target) -> List[str]:
        return ["type=registry"]

    def get_tags(self, target: Target) -> List[str]:
        return [self.get_stable_tag(target)]


@dataclass
class PullRequestEvent(BaseEvent):
    is_fork: bool
    pr_id: str
    pr_branch: str
    # the target branch name
    target_branch: str

    # the merge commit the CI runs on
    merge_hash: str
    # the head of the PR
    orig_hash: str
    # the target branch commit hash
    target_hash: str

    def version_string(self):
        return (
            f"pr {self.pr_id} ("
            f"merge of {self.pr_branch}@{short_hash(self.orig_hash)} "
            f"into {self.target_branch}@{short_hash(self.target_hash)})"
        )

    def get_stable_version(self) -> str:
        # edge/osrd-front:pr-42-HASH-nginx
        return f"pr-{self.pr_id}-{self.merge_hash}"

    def output_method(self):
        if not self.is_fork:
            return super().output_method()
        return "artifact"

    def get_output(self, target: Target) -> List[str]:
        if not self.is_fork:
            return super().get_output(target)
        return [f"type=docker,dest=osrd-{target.name}.tar"]

    def pr_tag(self, target: Target) -> str:
        # edge/osrd-front:pr-42-nginx  # pr-42 (merge of XXXX into XXXX)
        return self.tag(target, f"pr-{self.pr_id}")

    def get_tags(self, target: Target) -> List[str]:
        return [*super().get_tags(target), self.pr_tag(target)]


@dataclass
class MergeGroupEvent(BaseEvent):
    # the merge commit the CI runs on
    merge_hash: str
    # the ref the PR is merged into
    target_branch: str

    def version_string(self):
        return f"merge queue {self.merge_hash}"

    def get_stable_version(self) -> str:
        # edge/osrd-front:merge-queue-HASH
        return f"merge-queue-{self.merge_hash}"


@dataclass
class BranchEvent(BaseEvent):
    branch_name: str
    protected: bool
    commit_hash: str

    def version_string(self):
        return f"{self.branch_name} {short_hash(self.commit_hash)}"

    def get_stable_version(self) -> str:
        # edge/osrd-front:dev-HASH-nginx
        return f"{self.branch_name}-{self.commit_hash}"

    def branch_tag(self, target: Target) -> str:
        # edge/osrd-front:dev-nginx  # dev XXXX
        return self.tag(target, self.branch_name)

    def get_tags(self, target: Target) -> List[str]:
        return [*super().get_tags(target), self.branch_tag(target)]


@dataclass
class ReleaseEvent(BaseEvent):
    tag_name: str
    commit_hash: str
    draft: bool

    def version_string(self):
        return f"{self.get_stable_version()} {short_hash(self.commit_hash)}"

    def get_stable_version(self) -> str:
        # stable/osrd-front:1.0-devel  # 1.0 XXXX
        name = self.tag_name
        if self.draft:
            name = f"{name}-draft"
        return name

    def get_namespace(self) -> str:
        return DEFAULT_RELEASE_NAMESPACE

    def get_tags(self, target: Target) -> List[str]:
        if not target.release:
            return []
        return super().get_tags(target)


def parse_event(context) ->  Union[PullRequestEvent, MergeGroupEvent, BranchEvent, ReleaseEvent]:
    event_name = context["event_name"]
    event = context["event"]
    commit_hash = context["commit_hash"]
    branch = context["branch"]

    # How to check if commit is on protected branch ?
    # protected = context["ref_protected"] == "true"

    if event_name == "pull_request":
        pr = context["pull_requests_details"]
        is_fork = context["fork"]
        pr_id=pr["number"]
        target_branch = pr["base"]["ref"]
        orig_hash, target_hash =  pr["head"]["sha"], pr["base"]["sha"]
        return PullRequestEvent(
            is_fork=is_fork,
            pr_id=pr_id,
            pr_branch=pr["head"]["ref"],
            target_branch=target_branch,
            merge_hash=commit_hash,
            orig_hash=orig_hash,
            target_hash=target_hash,
        )

    # if event_name == "merge_group":
    #     merge_group = event["merge_group"]
    #     target_ref = merge_group["base_ref"]
    #     assert target_ref.startswith("refs/heads/")
    #     target_branch = target_ref.removeprefix("refs/heads/")
    #     return MergeGroupEvent(commit_hash, target_branch)

    # if event_name == "release":
    #     release = event["release"]
    #     return ReleaseEvent(
    #         release["tag_name"],
    #         commit_hash,
    #         release["draft"],
    #     )

    # if event_name in ("workflow_dispatch", "push"):
    #     return BranchEvent(ref_name, protected, commit_hash)

    raise ValueError(f"unknown event type: {event_name}")


def generate_bake_file(event, targets):
    bake_targets = {}
    for target in targets:
        target_manifest = {
            "tags": event.get_tags(target),
            "output": event.get_output(target) + ["type=image"],
        }
        target_manifest["cache-to"] = ["type=inline"]
        bake_targets[f"{target.name}"] = target_manifest

    version = event.version_string()
    bake_targets["base"] = {"args": {"OSRD_GIT_DESCRIBE": version}}
    return {"target": bake_targets}


def main():
    potential_pr = json.loads(os.environ["PULL_REQUESTS_JSON"])
    if type(potential_pr) is list:
        potential_pr = potential_pr[0]

    context = {
        "event_name": os.environ["PIPELINE_EVENT_NAME"],
        "event": os.environ["PIPELINE_EVENT_ACTION"],
        "commit_hash": os.environ["CIRCLE_SHA1"],
        "branch": os.environ["CIRCLE_BRANCH"],
        "username": os.environ["CIRCLE_PROJECT_USERNAME"],
        "fork": os.environ["IS_FORK"],
        "pull_requests_details": potential_pr
    }
    event = parse_event(context)
    bake_file = generate_bake_file(event, TARGETS)

    with open("bake-metadata.json", "w", encoding="utf-8") as f:
        json.dump(bake_file, f, indent=2)

    with open("tags.json", "w", encoding="utf-8") as f:
        stable_tags = {}
        for target in TARGETS:
            stable_tags[target.name] = event.get_stable_tag(target)
        json.dump(stable_tags, f, indent=2)

    gh_output_path = os.environ["BASH_ENV"]
    with open(gh_output_path, "a", encoding="utf-8") as f:
        print(f"export stable_version={event.get_stable_version()}", file=f)
        print(f"export output_method={event.output_method()}", file=f)

if __name__ == "__main__":
    main()
