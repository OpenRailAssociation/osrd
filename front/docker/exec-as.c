/*
Usage: exec-as UID GID PROGRAM [ARGS...]

Sets the effective and real uid and gid as requested, and
executes the program with any number of arguments.

It is, AFAIK, the simplest way to execute a program as a uid / gid:
- sudo does not work for numerical IDs with no associated user
- setuid does not work with shell scripts
- setuid does not set the real uid, which bash detects to drop
  back privileges, which we do not want.
*/

#define _GNU_SOURCE
#define _ISOC99_SOURCE

#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <err.h>
#include <grp.h>


int main(int argc, char *argv[]) {
    if (argc < 4) {
        fprintf(stderr, "Usage: %s UID GID PROGRAM [ARGS...]\n", argv[0]);
        return 1;
    }

    errno = 0;
    unsigned long uid = strtoul(argv[1], NULL, 10);
    if (errno)
        err(1, "Invalid uid");

    errno = 0;
    unsigned long gid = strtoul(argv[2], NULL, 10);
    if (errno)
        err(1, "Invalid gid");

    // remove all supplementary groups
    if (setgroups(0, NULL) != 0)
        err(1, "setgroups failed");

    // set the gid
    if (setregid(gid, gid) != 0)
        err(1, "setregid failed");

    // set the uid last, as it changes what capabilities are available
    if (setreuid(uid, uid) != 0)
        err(1, "setreuid failed");

    execvp(argv[3], argv + 3);
    err(1, "execvp failed");
}
