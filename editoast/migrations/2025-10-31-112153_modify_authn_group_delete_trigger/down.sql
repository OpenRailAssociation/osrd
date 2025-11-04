create trigger authn_group_delete_trigger before
delete on authn_group
for each row execute function delete_associated_authn_subject ();
