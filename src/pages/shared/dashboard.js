// §17, §18, §19 — Tableaux de bord national, de wilaya et d'établissement.
//
// Une seule implémentation : les trois niveaux partagent la même structure de
// statistiques, produite par les RPC `stats_national` / `stats_wilaya` /
// `stats_establishment` qui vérifient elles-mêmes le périmètre de l'appelant.
// Sur une base vide, tout affiche 0 — aucune donnée fictive (§1, §24).

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Badge } from '../../components/badge.js';
import {
  KPIGrid, SectionHead, Notice, Distribution, Bar, fmtNum, fmtPct, toDist,
} from '../../lib/ui.js';
import { typeAbbr, typeLabel, semLabel, ESTABLISHMENT_TYPES } from '../../lib/nomenclature.js';
import { statsNational, statsWilaya, statsEstablishment } from '../../lib/db.js';

const SCOPES = {
  ministry: {
    title: 'Tableau de bord national',
    breadcrumb: 'Ministère · Tableau de bord',
    navKey: 'nav.dashboard',
    role: 'ministry',
    fetch: statsNational,
    reports: '/ministere/rapports',
  },
  wilaya: {
    title: 'Tableau de bord de la wilaya',
    breadcrumb: 'Direction de wilaya · Tableau de bord',
    navKey: 'nav.dashboard',
    role: 'direction',
    fetch: () => statsWilaya(),
    reports: '/direction/rapports',
  },
  establishment: {
    title: 'Tableau de bord de l’établissement',
    breadcrumb: 'Établissement · Tableau de bord',
    navKey: 'nav.dashboard',
    role: 'admin',
    fetch: () => statsEstablishment(),
    reports: '/administration/rapports',
  },
};

function Section(title, subtitle, children) {
  return h('div', {}, [
    SectionHead(title, subtitle),
    ...(Array.isArray(children) ? children : [children]),
  ]);
}

function Panel(title, body) {
  return Card({ padding: 18 }, [
    h('h3.card__title', { style: { marginBottom: 12 } }, [title]),
    body,
  ]);
}

export function dashboardPage(scopeKey) {
  const S = SCOPES[scopeKey];

  return async function page() {
    return protectedPage({
      role: S.role,
      title: S.title,
      breadcrumb: S.breadcrumb,
      active: t(S.navKey),
      build: async ({ profile }) => {
        let stats;
        try {
          stats = await S.fetch();
        } catch (err) {
          return [Notice({ tone: 'danger', title: 'Statistiques indisponibles' }, [
            err.message || 'Aucun périmètre associé à votre compte.',
          ])];
        }

        const est = stats.establishments || {};
        const stu = stats.students || {};
        const aca = stats.academic || {};
        const tra = stats.training || {};
        const app = stats.apprenticeship || {};
        const int = stats.internships || {};

        const isEmpty = (stu.total || 0) === 0 && (est.total || 0) === 0;

        // ── Bandeau d'identité du périmètre ─────────────────────────────
        const scopeBanner = (() => {
          if (scopeKey === 'wilaya' && stats.wilaya) {
            return Card({ padding: 18, accent: true }, [
              h('div.kpi__label', {}, ['Périmètre']),
              h('div', { style: { fontSize: '17px', fontWeight: 700, marginTop: '2px' } }, [
                `Wilaya ${stats.wilaya.code} — ${stats.wilaya.name}`,
              ]),
              stats.wilaya.directorate_name
                && h('div.small.mute', {}, [stats.wilaya.directorate_name]),
            ].filter(Boolean));
          }
          if (scopeKey === 'establishment' && stats.establishment) {
            const e = stats.establishment;
            return Card({ padding: 18, accent: true }, [
              h('div.kpi__label', {}, ['Périmètre']),
              h('div', { style: { fontSize: '17px', fontWeight: 700, marginTop: '2px' } }, [e.name]),
              h('div.small.mute', {}, [
                `${typeLabel(e.type)}${e.code ? ` · ${e.code}` : ''}`,
              ]),
            ]);
          }
          return null;
        })();

        // ── §17 Institutions ────────────────────────────────────────────
        const typeDist = ESTABLISHMENT_TYPES
          .map((t) => ({ label: t.abbr, count: Number(est.by_type?.[t.value] || 0), key: t.value }))
          .filter((t) => t.count > 0);

        const institutionsBlock = scopeKey === 'establishment' ? null : Section(
          'Établissements',
          `${fmtNum(est.total)} au total · ${fmtNum(est.active)} actif(s)`,
          [
            h('div', {
              style: { display: 'grid', gap: 'var(--s-3)',
                       gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' },
            }, [
              Panel('Répartition par type', h('div', {}, [
                typeDist.length === 0
                  ? h('p.small.mute', {}, ['Aucun établissement enregistré.'])
                  : h('div', { style: { display: 'grid', gap: '10px' } }, ESTABLISHMENT_TYPES.map((t) => {
                      const n = Number(est.by_type?.[t.value] || 0);
                      const max = Math.max(...typeDist.map((x) => x.count), 1);
                      return h('div', { title: t.label }, [
                        h('div', { style: { display: 'flex', justifyContent: 'space-between',
                                            gap: '10px', marginBottom: '3px' } }, [
                          h('span', { style: { fontSize: '12.5px', fontWeight: n ? 600 : 400,
                                               color: n ? 'inherit' : 'var(--c-mute)' } }, [t.abbr]),
                          h('span.mono.small', {}, [String(n)]),
                        ]),
                        Bar(n ? (n / max) * 100 : 0),
                      ]);
                    })),
              ])),
              scopeKey === 'ministry'
                ? Panel('Répartition par wilaya',
                    Distribution(
                      (est.by_wilaya || []).map((w) => ({
                        label: `${w.code} — ${w.wilaya}`, count: w.count,
                      })),
                      { empty: 'Aucune wilaya renseignée.' }
                    ))
                : Panel('Étudiants par établissement',
                    Distribution(
                      (stu.by_establishment || []).map((e) => ({ label: e.establishment, count: e.count })),
                      { empty: 'Aucun étudiant enregistré.' }
                    )),
            ]),
          ]
        );

        // ── §17 Étudiants ───────────────────────────────────────────────
        const semDist = ['s1', 's2', 's3', 's4', 's5'].map((s) => ({
          label: semLabel(s), count: Number(stu.by_semester?.[s] || 0),
        }));

        const studentsBlock = Section(
          'Étudiants',
          `${fmtNum(stu.total)} inscrit(s) · ${fmtNum(stu.graduated)} diplômé(s)`,
          [
            KPIGrid([
              { label: 'Total étudiants', value: fmtNum(stu.total) },
              { label: 'En cours de formation', value: fmtNum(stu.active) },
              { label: 'Diplômés', value: fmtNum(stu.graduated) },
              { label: 'Redoublants', value: fmtNum(stu.repeating) },
              { label: 'Exclus', value: fmtNum(stu.dismissed) },
              { label: 'Comptes en attente', value: fmtNum(stu.pending),
                tone: (stu.pending || 0) > 0 ? 'warn' : null },
            ]),
            h('div', {
              style: { display: 'grid', gap: 'var(--s-3)', marginTop: 'var(--s-3)',
                       gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' },
            }, [
              Panel('Par semestre', Distribution(semDist, { empty: 'Aucun étudiant.' })),
              Panel('Par mode de formation', Distribution(
                (stu.by_mode || []).map((m) => ({ label: m.mode, count: m.count })),
                { empty: 'Aucun mode renseigné.' })),
              Panel('Par spécialité', Distribution(
                (stu.by_specialty || []).slice(0, 8).map((s) => ({ label: s.specialty, count: s.count })),
                { empty: 'Aucune spécialité.' })),
              Panel('Par programme', Distribution(
                (stu.by_program || []).slice(0, 8).map((p) => ({ label: p.program, count: p.count })),
                { empty: 'Aucun programme.' })),
            ]),
          ]
        );

        // ── §17 Progression académique ──────────────────────────────────
        const academicBlock = Section(
          'Progression académique',
          'Validation des semestres, rattrapages et résultats',
          [
            KPIGrid([
              { label: 'Semestres validés', value: fmtNum(aca.validated) },
              { label: 'En rattrapage', value: fmtNum(aca.pending_resit),
                tone: (aca.pending_resit || 0) > 0 ? 'warn' : null },
              { label: 'Rattrapage non validé', value: fmtNum(aca.resit_failed),
                tone: (aca.resit_failed || 0) > 0 ? 'danger' : null },
              { label: 'Taux de réussite', value: fmtPct(aca.success_rate) },
              { label: 'Moyenne générale', value: aca.average != null ? Number(aca.average).toFixed(2) : '—',
                suffix: '/20' },
              { label: 'Assiduité', value: fmtPct(aca.attendance_rate) },
            ]),
            h('div', { style: { marginTop: 'var(--s-3)' } }, [
              Panel('Résultats par semestre', (() => {
                const rows = ['s1', 's2', 's3', 's4', 's5']
                  .map((s) => ({ code: s, ...(aca.by_semester?.[s] || {}) }))
                  .filter((r) => r.total);
                if (rows.length === 0) {
                  return h('p.small.mute', {}, ['Aucun relevé semestriel enregistré.']);
                }
                return h('table.table.table--dense', {}, [
                  h('thead', {}, [h('tr', {}, [
                    h('th', {}, ['Semestre']),
                    h('th', { style: { textAlign: 'right' } }, ['Relevés']),
                    h('th', { style: { textAlign: 'right' } }, ['Validés']),
                    h('th', { style: { textAlign: 'right' } }, ['Rattrapage']),
                    h('th', { style: { textAlign: 'right' } }, ['Moyenne']),
                    h('th', {}, ['Taux de validation']),
                  ])]),
                  h('tbody', {}, rows.map((r) => {
                    const pct = r.total ? (r.validated / r.total) * 100 : 0;
                    return h('tr', {}, [
                      h('td.mono', {}, [semLabel(r.code)]),
                      h('td.mono', { style: { textAlign: 'right' } }, [fmtNum(r.total)]),
                      h('td.mono', { style: { textAlign: 'right' } }, [fmtNum(r.validated)]),
                      h('td.mono', { style: { textAlign: 'right' } }, [fmtNum(r.resit)]),
                      h('td.mono', { style: { textAlign: 'right' } },
                        [r.average != null ? Number(r.average).toFixed(2) : '—']),
                      h('td', { style: { minWidth: '140px' } }, [
                        Bar(pct, pct >= 60 ? 'success' : pct >= 30 ? 'warn' : 'danger'),
                        h('span.mono.small.mute', {}, [fmtPct(pct, 0)]),
                      ]),
                    ]);
                  })),
                ]);
              })()),
            ]),
          ]
        );

        // ── §17 Offre de formation ──────────────────────────────────────
        const capacity = tra.capacity_vs_enrolled || {};
        const fillRate = capacity.capacity ? (capacity.enrolled / capacity.capacity) * 100 : null;

        const trainingBlock = Section(
          'Offre de formation',
          'Programmes, spécialités, classes et capacité d’accueil',
          [
            KPIGrid([
              { label: 'Programmes nationaux', value: fmtNum(tra.programs),
                sub: `${fmtNum(tra.published)} publié(s)` },
              { label: 'Filières', value: fmtNum(tra.fields) },
              { label: 'Modes de formation', value: fmtNum(tra.modes) },
              { label: 'Spécialités ouvertes', value: fmtNum(tra.specialties) },
              { label: 'Classes', value: fmtNum(tra.groups) },
              { label: 'Sessions', value: fmtNum(tra.sessions) },
              { label: 'Professeurs', value: fmtNum(tra.teachers) },
              { label: 'Places offertes', value: fmtNum(tra.seats) },
            ]),
            fillRate != null && h('div', { style: { marginTop: 'var(--s-3)' } }, [
              Panel('Capacité et remplissage', h('div', {}, [
                h('div', { style: { display: 'flex', justifyContent: 'space-between',
                                    marginBottom: '6px', fontSize: '13px' } }, [
                  h('span', {}, [`${fmtNum(capacity.enrolled)} inscrits sur ${fmtNum(capacity.capacity)} places`]),
                  h('strong.mono', {}, [fmtPct(fillRate, 0)]),
                ]),
                Bar(fillRate, fillRate > 100 ? 'danger' : fillRate >= 70 ? 'success' : 'warn'),
              ])),
            ]),
          ]
        );

        // ── §17 Apprentissage & stages ──────────────────────────────────
        const contractsBlock = Section(
          'Apprentissage et stages',
          'Contrats d’apprentissage et conventions de stage pratique S5',
          [
            h('div', {
              style: { display: 'grid', gap: 'var(--s-3)',
                       gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' },
            }, [
              Panel('Contrats d’apprentissage', h('div', {}, [
                KPIGrid([
                  { label: 'Étudiants concernés', value: fmtNum(app.students) },
                  { label: 'Contrats déposés', value: fmtNum(app.submitted) },
                  { label: 'En attente', value: fmtNum((app.pending || 0) + (app.review || 0)),
                    tone: (app.pending || 0) + (app.review || 0) > 0 ? 'warn' : null },
                  { label: 'Approuvés', value: fmtNum(app.approved) },
                  { label: 'Refusés', value: fmtNum(app.rejected) },
                  { label: 'Modification requise', value: fmtNum(app.changes) },
                ]),
              ])),
              Panel('Stages pratiques S5', h('div', {}, [
                KPIGrid([
                  { label: 'Étudiants en S5', value: fmtNum(int.s5_students) },
                  { label: 'Conventions déposées', value: fmtNum(int.submitted) },
                  { label: 'Sans convention', value: fmtNum(int.missing),
                    tone: (int.missing || 0) > 0 ? 'warn' : null },
                  { label: 'Approuvées', value: fmtNum(int.approved) },
                  { label: 'Terminés', value: fmtNum(int.completed) },
                  { label: 'Organismes d’accueil', value: fmtNum(int.companies) },
                ]),
              ])),
            ]),
            (int.locations || []).length > 0 && h('div', { style: { marginTop: 'var(--s-3)' } }, [
              Panel('Lieux de stage', Distribution(
                (int.locations || []).slice(0, 10).map((l) => ({ label: l.location, count: l.count })),
                { empty: 'Aucun lieu renseigné.' })),
            ]),
          ]
        );

        // ── §17 spécifique national : wilayas et comptes ────────────────
        const nationalBlock = scopeKey !== 'ministry' ? null : Section(
          'Territoire et comptes',
          'Wilayas, directions et utilisateurs de la plateforme',
          [
            KPIGrid([
              { label: 'Wilayas', value: fmtNum(stats.wilayas?.total),
                sub: `${fmtNum(stats.wilayas?.active)} active(s)` },
              { label: 'Directions dotées', value: fmtNum(stats.wilayas?.with_admin),
                sub: 'compte de direction créé' },
              { label: 'Comptes', value: fmtNum(stats.users?.total) },
              { label: 'En attente', value: fmtNum(stats.users?.pending),
                tone: (stats.users?.pending || 0) > 0 ? 'warn' : null },
            ]),
            h('div', { style: { marginTop: 'var(--s-3)' } }, [
              Panel('Vue par wilaya', (() => {
                const rows = stats.per_wilaya || [];
                if (rows.length === 0) {
                  return h('p.small.mute', {}, ['Aucune wilaya enregistrée.']);
                }
                return h('table.table.table--dense', {}, [
                  h('thead', {}, [h('tr', {}, [
                    h('th', {}, ['Code']), h('th', {}, ['Wilaya']),
                    h('th', { style: { textAlign: 'right' } }, ['Établissements']),
                    h('th', { style: { textAlign: 'right' } }, ['Étudiants']),
                    h('th', {}, ['Statut']),
                  ])]),
                  h('tbody', {}, rows.map((w) => h('tr', {}, [
                    h('td.mono', {}, [w.code]),
                    h('td', {}, [w.name]),
                    h('td.mono', { style: { textAlign: 'right' } }, [fmtNum(w.establishments)]),
                    h('td.mono', { style: { textAlign: 'right' } }, [fmtNum(w.students)]),
                    h('td', {}, [w.status === 'active'
                      ? Badge({ tone: 'success', size: 'sm', dot: true }, ['actif'])
                      : Badge({ tone: 'neutral', size: 'sm', dot: true }, ['inactif'])]),
                  ]))),
                ]);
              })()),
            ]),
          ]
        );

        // ── §19 spécifique établissement : classes et dossiers ──────────
        const establishmentBlock = scopeKey !== 'establishment' ? null : Section(
          'Vie de l’établissement',
          'Classes, dossiers en attente et demandes administratives',
          [
            KPIGrid([
              { label: 'Contrats à traiter', value: fmtNum(stats.pending_contracts),
                tone: (stats.pending_contracts || 0) > 0 ? 'warn' : null },
              { label: 'Demandes de documents', value: fmtNum(stats.document_requests),
                tone: (stats.document_requests || 0) > 0 ? 'warn' : null },
            ]),
            h('div', { style: { marginTop: 'var(--s-3)' } }, [
              Panel('Étudiants par classe', Distribution(
                (stats.by_group || []).map((g) => ({ label: g.group, count: g.count })),
                { empty: 'Aucune classe créée.' })),
            ]),
          ]
        );

        return [
          scopeBanner,

          isEmpty
            ? Notice({ tone: 'info', title: 'Plateforme vierge' }, [
                scopeKey === 'ministry'
                  ? 'Aucune donnée n’a encore été saisie. Créez les wilayas, puis les établissements, '
                    + 'les modes de formation et les programmes : les statistiques se construiront '
                    + 'à partir des données réelles.'
                  : 'Aucune donnée dans votre périmètre pour l’instant. Les indicateurs se '
                    + 'rempliront au fur et à mesure des inscriptions.',
              ])
            : null,

          h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, [
            Button({ label: 'Générer un rapport', icon: 'file-text', variant: 'secondary',
                     href: S.reports }),
          ]),

          nationalBlock,
          institutionsBlock,
          studentsBlock,
          academicBlock,
          trainingBlock,
          contractsBlock,
          establishmentBlock,
        ].filter(Boolean);
      },
    });
  };
}

export const ministryDashboardPage = dashboardPage('ministry');
export const wilayaDashboardPage = dashboardPage('wilaya');
export const establishmentDashboardPage = dashboardPage('establishment');
