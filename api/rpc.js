// ─────────────────────────────────────────────────────────────────────────────
//  /api/rpc — appel des fonctions PostgreSQL exposées.
//
//  Seules les fonctions explicitement listées sont appelables. Chacune vérifie
//  déjà le rôle et le périmètre de l'appelant côté base ; cette liste est une
//  seconde barrière, pour qu'aucune fonction interne ne devienne joignable par
//  accident depuis le navigateur.
// ─────────────────────────────────────────────────────────────────────────────

import { withUser, pgErrorStatus } from './_lib/pg.js';
import { json, fail, readJSON, methodGuard } from './_lib/http.js';
import { currentUser } from './_lib/session.js';

// nom → { args: [ordre des paramètres], public: accessible sans compte }
const ALLOWED = {
  // Lecture publique (formulaire d'inscription)
  public_establishments: { args: [], public: true },
  public_wilayas:        { args: [], public: true },

  // Statistiques et consultation
  stats_national:        { args: [] },
  stats_wilaya:          { args: ['p_wilaya'] },
  stats_establishment:   { args: ['p_estab'] },
  student_overview:      { args: ['p_student'] },
  effective_academic_rule: { args: ['p_establishment'] },
  search_students: { args: ['p_query', 'p_wilaya', 'p_estab', 'p_type', 'p_specialty',
                            'p_program', 'p_mode', 'p_semester', 'p_enrollment',
                            'p_academic', 'p_contract', 'p_limit', 'p_offset'] },

  // Gestion des comptes et du territoire
  create_account: { args: ['p_email', 'p_password', 'p_role', 'p_first_name', 'p_last_name',
                           'p_phone', 'p_establishment_id', 'p_wilaya_id', 'p_direction_id',
                           'p_student_number', 'p_specialty_id', 'p_group_id', 'p_program_id',
                           'p_training_mode_id', 'p_permissions'] },
  create_wilaya_with_admin: { args: ['p_code', 'p_name', 'p_directorate_name', 'p_address',
                                     'p_contact_email', 'p_contact_phone', 'p_admin_email',
                                     'p_admin_password', 'p_admin_first_name', 'p_admin_last_name'] },
  set_account_status: { args: ['p_user', 'p_status'] },
  delete_account:     { args: ['p_user'] },
  set_permissions:    { args: ['p_user', 'p_permissions'] },

  // Pédagogie
  apply_semester_decision:  { args: ['p_semester_row', 'p_decision', 'p_note'] },
  recalc_student_semester:  { args: ['p_student', 'p_semester', 'p_year'] },

  // Notifications
  mark_notifications_read: { args: ['p_ids'] },
  broadcast_announcement:  { args: ['p_title', 'p_body', 'p_scope', 'p_target', 'p_roles'] },
};

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  try {
    const { fn, args = {} } = await readJSON(req);
    const spec = ALLOWED[fn];
    if (!spec) return fail(res, 404, `Fonction non exposée : ${fn}`);

    const user = await currentUser(req, res);
    if (!spec.public && !user) return fail(res, 401, 'Authentification requise.');

    // Appel par paramètres nommés : l'ordre côté client n'a aucune importance
    // et les valeurs absentes prennent leur défaut PostgreSQL.
    const provided = spec.args.filter((a) => args[a] !== undefined && args[a] !== null);
    const placeholders = provided.map((a, i) => `${a} => $${i + 1}`).join(', ');
    const values = provided.map((a) => args[a]);

    const rows = await withUser(user?.id || null, async (client) => {
      const r = await client.query(`select * from public.${fn}(${placeholders})`, values);
      return r.rows;
    });

    // Une fonction scalaire renvoie une colonne unique portant son nom.
    let data = rows;
    if (rows.length === 1 && Object.keys(rows[0]).length === 1 && fn in rows[0]) {
      data = rows[0][fn];
    } else if (rows.length === 1 && spec.args.length && !Array.isArray(data)
               && Object.keys(rows[0]).length === 1) {
      data = Object.values(rows[0])[0];
    }
    return json(res, 200, { data });
  } catch (err) {
    const status = err.status || pgErrorStatus(err);
    if (status >= 500) console.error('[api/rpc]', err);
    return fail(res, status, status >= 500 ? 'Erreur serveur.' : err.message);
  }
}
