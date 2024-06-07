import argparse


parser = argparse.ArgumentParser()
parser.add_argument("changed_files")
parser.add_argument("pr_description")
args = parser.parse_args()

if "python/osrd_schemas/" in args.changed_files:
    print("You changed osrd_schemas!")
    exit(1)
