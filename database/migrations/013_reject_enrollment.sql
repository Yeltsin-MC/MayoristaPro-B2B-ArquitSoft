-- El administrador puede rechazar una solicitud de alta (por ejemplo, una empresa falsa).
-- La solicitud se borra junto con su cuenta y empresa pendientes, y queda en la bitácora.
ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_action_check
  CHECK (action IN ('retire-product','restore-product','suspend-company','reactivate-company','reject-enrollment'));
