SELECT *
FROM authz_grant_authn_group
LEFT JOIN authn_group_membership WHERE authn_group_membership."user" = $user
WHERE resource = $ressource AND "grant" > $required_priv AND ($user = subject OR authn_group_membership."group" = subject);

SELECT *
FROM authz_grant_authn_group
LEFT JOIN authn_group_membership WHERE authn_group_membership."user" = $user
WHERE resource = $ressource AND "grant" > $required_priv AND ($user = subject OR authn_group_membership."group" = subject);
