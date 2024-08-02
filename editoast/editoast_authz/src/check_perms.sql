SELECT *
FROM authz_grant_authn_group
LEFT JOIN authn_group_membership ON authn_group_membership."user" = $user
WHERE resource = $ressource AND ($user = subject OR authn_group_membership."group" = subject);

UNION

SELECT *, 'implicit', 'project'
FROM authz_grant_authn_group
LEFT JOIN authn_group_membership ON authn_group_membership."user" = $user
WHERE resource = $ressource AND ($user = subject OR authn_group_membership."group" = subject);
