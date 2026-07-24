-- CASE OS v4.32.1: fail-closed permissions for the external-agent role.
-- Existing AGX accounts keep their identities, but corporate registries and LCR/SCR
-- are no longer granted through the generic role matrix. New brand/investor leads use
-- dedicated moderated endpoints; project/unit access will be introduced separately.
UPDATE roles
SET label='Внешний агент',
    leasing=0,
    finance=0,
    edit=0,
    approve=0,
    plans=0,
    own_only=1,
    project_scope=1,
    admin=0
WHERE `key`='AGX';
