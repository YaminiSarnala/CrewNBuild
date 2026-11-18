// Pieces of the Site Engineer screens, ported from the web
// pages/engineer/engineerSections.jsx: the project card (My Projects), Join
// Builder Team, Discover Builders, Find Opportunities, and the builder-profile
// and opportunity sheets. Same fields, same labels (web keys), same actions.
import { useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { Image } from 'expo-image'
import {
  ArrowRight, ArrowUpRight, Briefcase, Building2, CalendarDays, CheckCircle2, Clock, FileText, HardHat,
  Mail, MapPin, Phone, Star, UserRound,
} from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { imageSource } from '../../api/client'
import { userAvatarSource } from '../../utils/avatars'
import { ratingLabel } from '../../utils/ratingLabel'
import { constructionTypeLabel } from '../../utils/roleLabels'
import { SERVICE_OPTION_KEYS } from '../../i18n/optionKeys'
import { formatCalendarDate } from '../../utils/formatters'
import {
  buildingTypeText, completionPercent, completionText, formatPercent, money, projectStatusText, scheduleText, scheduleWidth,
} from '../../utils/builderHelpers'
import { Notice, SheetModal } from '../../components/builder/BuilderUi'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

/** Initials from the name; a translated word only when there is no name. */
function avatarInitials(name, fallbackLabel, length = 2) {
  const typed = String(name || '').trim()
  if (typed) return typed.slice(0, length).toUpperCase()
  return String(fallbackLabel || '').trim().slice(0, length)
}

export function teamStatusMeta(status, t) {
  if (status === 'ACTIVE') return { label: t('dash.engineer.team.activeMember'), bg: '#ecfdf5', fg: '#047857' }
  if (status === 'PENDING') return { label: t('dash.engineer.team.requestPending'), bg: '#f0f6f2', fg: '#1a5038' }
  if (status === 'REJECTED') return { label: t('dash.engineer.team.declined'), bg: '#fff1f2', fg: '#e11d48' }
  return { label: t('dash.engineer.team.unknown'), bg: '#f1f5f9', fg: '#475569' }
}

function StatusPill({ meta }) {
  return (
       <View style={[styles.ep17, { backgroundColor: soft(meta.bg, meta.fg) }]}>
      <Text style={[styles.ep18, { color: ink(meta.fg) }]}>{meta.label}</Text>
    </View>
  )
}

/** The dashed empty card the web shows when a list has nothing yet. */
export function EmptyCard({ icon: Icon, title, body }) {
  return (
    <View style={styles.ep19}>
      {Icon ? <Icon size={30} color={COLORS.brand[400]} /> : null}
      <Text style={styles.ep20}>{title}</Text>
      {body ? <Text style={styles.ep21}>{body}</Text> : null}
    </View>
  )
}

function Card({ children }) {
  return <View style={styles.ep16}>{children}</View>
}

function Eyebrow({ children, right }) {
  return (
    <View style={styles.ep22}>
      <Text style={styles.ep23}>{children}</Text>
      {right}
    </View>
  )
}

function InitialsDot({ text, muted = false }) {
  return (
    <View style={[styles.ep1, muted ? styles.ep2 : styles.ep3]}>
      <Text style={[styles.ep4, muted ? styles.ep5 : styles.ep6]}>{text}</Text>
    </View>
  )
}

function Pill({ icon: Icon, text, bg = '#f1f5f9', fg = '#475569' }) {
  return (
    <View style={[styles.ep7, { backgroundColor: soft(bg, fg) }]}>
              {Icon ? <Icon size={11} color={fg} /> : null}
      <Text style={[styles.ep24, { color: ink(fg) }]} numberOfLines={1}>{text}</Text>
          </View>
  )
}

// ---------------------------------------------------------------------------
// My Projects: the compact project card (web EngineerMyProjectsSection)
// ---------------------------------------------------------------------------

export function EngineerProjectCard({ project, onOpen }) {
  const { t, td } = useLanguage()
  const builderCompany = td(project.company_name || '')
  const builderPerson = td(project.contractor_name || project.owner_name || '')
  const identityTop = builderCompany || builderPerson || t('dash.engineer.yourBuilder')
  const identityBottom = builderPerson && builderPerson !== identityTop ? builderPerson : ''
  const amount = project.contract_amount ?? project.awarded_amount ?? project.budget
  const started = project.work_started === true
  const elapsed = started ? scheduleWidth(project) : 0
  const schedule = scheduleText(project, t)
  const endDate = formatCalendarDate(project.end_date, '', { month: 'short', year: 'numeric' })
  const buildingType = buildingTypeText(project.building_type, t)
  const status = String(project.status || '').toLowerCase()
  const statusText = status ? projectStatusText(project.status, t) : ''
  const statusLive = status === 'active' || status === 'in_progress' || status === 'accepted'
  const subtitle = identityBottom ? `${identityTop} · ${identityBottom}` : identityTop
  const hasCompletion = completionPercent(project) !== null
  const progressValue = hasCompletion
    ? completionText(project, t)
    : !started
      ? t('progress.scheduleNotStarted')
      : ['in_progress', 'end_date_passed'].includes(project.schedule_status) ? formatPercent(elapsed) : ''
  const progressLabel = hasCompletion ? t('dash.engineer.complete') : t('dash.contractor.progress')

  return (
    <Pressable onPress={() => onOpen(project)} style={styles.ep25}>
      <View style={styles.ep26}>
        <View style={styles.ep27}>
          {project.cover_image_url
            ? <Image source={imageSource(project.cover_image_url)} style={{ width: 44, height: 44 }} contentFit="cover" />
            : <Text style={styles.ep28}>{avatarInitials(project.title, t('dash.common.project'), 1)}</Text>}
        </View>
        <View style={styles.ep29}>
          <Text style={styles.ep30} numberOfLines={1}>{td(project.title)}</Text>
          <Text style={styles.ep31} numberOfLines={1}>{subtitle}</Text>
        </View>
        {statusText ? (
          <View style={[styles.ep7, statusLive ? styles.ep8 : styles.ep9]}>
            <View style={[styles.ep10, statusLive ? styles.ep11 : styles.ep12]} />
            <Text style={[styles.ep13, statusLive ? styles.ep14 : styles.ep15]}>{statusText}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.ep32}>
        <Pill icon={MapPin} text={project.pincode || '—'} bg="#ecfdf5" fg="#047857" />
        {buildingType ? <Pill text={buildingType} bg="#f0f9ff" fg="#0369a1" /> : null}
        {endDate ? <Pill icon={CalendarDays} text={endDate} bg="#fff7ed" fg="#c2410c" /> : null}
      </View>
      <View style={styles.ep33}>
        <Text style={styles.ep34}>{progressValue ? `${progressLabel}: ${progressValue}` : ''}</Text>
        {amount ? <Text style={styles.ep35}>{money(amount, project.project_country)}</Text> : null}
      </View>
      <View style={styles.ep36}>
        <View style={[styles.ep37, { width: `${elapsed}%` }]} />
      </View>
      <View style={styles.ep38}>
        <Text style={styles.ep39} numberOfLines={1}>{schedule ? `${t('progress.schedule')}: ${schedule}` : ''}</Text>
        <View style={styles.ep40}>
          <Text style={styles.ep41}>{t('dash.engineer.openProject')}</Text>
          <ArrowUpRight size={12} color={COLORS.brand[700]} />
        </View>
      </View>
    </Pressable>
  )
}

export function EngineerMyProjects({ projectList, onOpenProject }) {
  const { t } = useLanguage()
  if (!projectList.length) {
    return <EmptyCard icon={HardHat} title={t('dash.engineer.noAssignedProjects')} body={t('dash.engineer.noAssignedProjectsSub')} />
  }
  return projectList.map((project) => <EngineerProjectCard key={project.id} project={project} onOpen={onOpenProject} />)
}

// ---------------------------------------------------------------------------
// Join Builder Team (web EngineerJoinTeamSection)
// ---------------------------------------------------------------------------

export function EngineerJoinTeam({ teams, incomingRequests, onJoin, onRefresh, onRespondToBuilder, joinMessage, joinError }) {
  const { t, td } = useLanguage()
  const [code, setCode] = useState('')
  const activeTeams = teams.filter((team) => team.status === 'ACTIVE')
  const pendingTeams = teams.filter((team) => team.status !== 'ACTIVE')
  const builderLine = (row) => `${td(row.contractor_name)} · ${t('dash.common.pincode')} ${row.pincode || '—'}`

  return (
    <View>
      <Card>
        <Eyebrow right={(
          <Pressable onPress={onRefresh} style={styles.ep42}>
            <Text style={styles.ep43}>{t('dash.engineer.refresh')}</Text>
          </Pressable>
        )}
        >
          {t('dash.engineer.joinTeam')}
        </Eyebrow>
        <View style={styles.ep44}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={t('dash.engineer.msg.enterCode')}
            placeholderTextColor={COLORS.slate[400]}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.ep45}
          />
          <Pressable onPress={() => onJoin(code.trim())} style={styles.ep46}>
            <Text style={styles.ep47}>{t('dash.engineer.joinTeam')}</Text>
          </Pressable>
        </View>
        {joinMessage ? <View style={styles.ep48}><Notice tone="success" text={joinMessage} /></View> : null}
        {joinError ? <View style={styles.ep48}><Notice tone="error" text={joinError} /></View> : null}
      </Card>

      {activeTeams.length > 0 ? (
        <Card>
          <Eyebrow>{t('dash.engineer.myTeam')}</Eyebrow>
          {activeTeams.map((team) => (
            <View key={team.relationship_id} style={styles.ep49}>
              <InitialsDot text={avatarInitials(team.company_name || team.contractor_name, t('role.builder'))} />
              <View style={styles.ep29}>
                <Text style={styles.ep35} numberOfLines={1}>{td(team.company_name)}</Text>
                <Text style={styles.ep50} numberOfLines={1}>{builderLine(team)}</Text>
              </View>
              <StatusPill meta={teamStatusMeta(team.status, t)} />
            </View>
          ))}
        </Card>
      ) : null}

      {incomingRequests.length > 0 ? (
        <Card>
          <Eyebrow>{t('dash.engineer.incomingBuilderRequests')}</Eyebrow>
          {incomingRequests.map((request) => (
            <View key={request.relationship_id} style={styles.ep51}>
              <View style={styles.ep52}>
                <InitialsDot text={avatarInitials(request.company_name || request.contractor_name, t('role.builder'))} />
                <View style={styles.ep29}>
                  <Text style={styles.ep35} numberOfLines={1}>{td(request.company_name || request.contractor_name)}</Text>
                  <Text style={styles.ep50} numberOfLines={1}>{builderLine(request)}</Text>
                </View>
              </View>
              <View style={styles.ep53}>
                <Pressable onPress={() => onRespondToBuilder(request.relationship_id, 'ACCEPT')} style={styles.ep54}>
                  <CheckCircle2 size={14} color="#ffffff" />
                  <Text style={styles.ep55}>{t('ce.accept')}</Text>
                </Pressable>
                <Pressable onPress={() => onRespondToBuilder(request.relationship_id, 'REJECT')} style={styles.ep56}>
                  <Text style={styles.ep57}>{t('ce.reject')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {pendingTeams.length > 0 ? (
        <Card>
          <Eyebrow>{t('ui.requests')}</Eyebrow>
          {pendingTeams.map((team) => (
            <View key={team.relationship_id} style={styles.ep49}>
              <InitialsDot muted text={avatarInitials(team.company_name || team.contractor_name, t('role.builder'))} />
              <View style={styles.ep29}>
                <Text style={styles.ep35} numberOfLines={1}>{td(team.company_name)}</Text>
                <Text style={styles.ep50} numberOfLines={1}>{builderLine(team)}</Text>
              </View>
              <StatusPill meta={teamStatusMeta(team.status, t)} />
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Discover Builders (web EngineerContractorsSection)
// ---------------------------------------------------------------------------

export function EngineerContractors({ contractors, teamStatusByContractor, onViewContractor, onRequestJoin, message }) {
  const { t, td } = useLanguage()
  return (
    <View>
      {message ? <Notice tone="info" text={message} /> : null}
      {!contractors.length ? (
        <EmptyCard icon={Building2} title={t('dash.engineer.noBuilders')} body={t('dash.engineer.noBuildersSub')} />
      ) : contractors.map((contractor) => {
        const teamState = teamStatusByContractor(contractor.user_id)
        return (
          <Pressable key={contractor.user_id} onPress={() => onViewContractor(contractor)} style={styles.ep25}>
            <View style={styles.ep52}>
              <Image
                source={contractor.company_logo_url ? imageSource(contractor.company_logo_url) : userAvatarSource(contractor, 'CONTRACTOR')}
                style={{ width: 44, height: 44, borderRadius: 12 }}
                contentFit="cover"
              />
              <View style={styles.ep29}>
                <Text style={styles.ep58}>{t('role.contractor')}</Text>
                <Text style={styles.ep30} numberOfLines={1}>{td(contractor.company_name)}</Text>
                <Text style={styles.ep59}>{`${contractor.completed_projects || 0} ${t('dash.supplier.projects')}`}</Text>
              </View>
            </View>
            <View style={styles.ep32}>
              <Pill icon={MapPin} text={`${t('dash.common.pincode')} ${contractor.pincode || '—'}`} />
              <Pill text={`${contractor.experience_years || 0} ${t('dash.supplier.yrs')}`} />
              <Pill icon={Star} text={String(contractor.rating || t('dash.common.new'))} bg="#f0f6f2" fg="#1a5038" />
            </View>
            {teamState === 'active' ? (
              <View style={styles.ep60}><Pill icon={CheckCircle2} text={t('dash.engineer.inYourTeam')} bg="#ecfdf5" fg="#047857" /></View>
            ) : teamState === 'pending' ? (
              <View style={styles.ep60}><Pill icon={Clock} text={t('dash.engineer.requestSent')} bg="#fff7ed" fg="#c2410c" /></View>
            ) : (
              <Pressable onPress={() => onRequestJoin(contractor)} style={styles.ep61}>
                <UserRound size={14} color="#ffffff" />
                <Text style={styles.ep62}>{t('dash.engineer.requestToJoin')}</Text>
              </Pressable>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Find Opportunities (web EngineerOpportunitiesSection)
// ---------------------------------------------------------------------------

export function EngineerOpportunities({ opportunities, appliedKeys, onApply, onView, message }) {
  const { t, td } = useLanguage()
  return (
    <View>
      {message ? <Notice tone="info" text={message} /> : null}
      {!opportunities.length ? (
        <EmptyCard icon={Briefcase} title={t('dash.engineer.noOpportunities')} body={t('dash.engineer.noOpportunitiesSub')} />
      ) : (
        <View style={styles.ep63}>
          {opportunities.map((opportunity) => {
            const applied = appliedKeys.includes(String(opportunity.project_id))
            return (
              <View key={opportunity.project_id} style={styles.ep64}>
                <View style={styles.ep65}>
                  <Text style={styles.ep66} numberOfLines={2}>{td(opportunity.title)}</Text>
                  <View style={styles.ep67}>
                    <Text style={styles.ep43}>{money(opportunity.budget, opportunity.project_country)}</Text>
                  </View>
                </View>
                <View style={styles.ep68}>
                  <Building2 size={12} color={COLORS.brand[700]} />
                  <Text style={styles.ep69} numberOfLines={1}>{td(opportunity.company_name)}</Text>
                </View>
                <View style={styles.ep70}>
                  <MapPin size={12} color={COLORS.brand[700]} />
                  <Text style={styles.ep69} numberOfLines={1}>{`${td(opportunity.address)} · ${opportunity.pincode || ''}`}</Text>
                </View>
                {opportunity.construction_type ? <Text style={styles.ep71}>{constructionTypeLabel(opportunity.construction_type, t)}</Text> : null}
                <View style={styles.ep72}>
                  <Pressable onPress={() => onView(opportunity)} style={styles.ep73}>
                    <Text style={styles.ep43}>{t('dash.engineer.viewOpportunity')}</Text>
                  </Pressable>
                  {applied ? (
                    <View style={styles.ep74}>
                                         <CheckCircle2 size={14} color={ink('#047857')} />
                      <Text style={styles.ep75}>{t('dash.engineer.applied')}</Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => onApply(opportunity)} style={styles.ep76}>
                      <Text style={styles.ep55}>{t('dash.engineer.apply')}</Text>
                      <ArrowRight size={14} color="#ffffff" />
                    </Pressable>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Sheets (web ContractorProfileModal, OpportunityDetailModal)
// ---------------------------------------------------------------------------

function InfoTile({ icon: Icon, label, value, blur = false }) {
  return (
    <View style={styles.ep77}>
      <Icon size={16} color={COLORS.brand[700]} />
      <View style={styles.ep29}>
        <Text style={styles.ep58}>{label}</Text>
        <Text style={[styles.ep78, blur ? { opacity: 0.25 } : null]} numberOfLines={1}>{blur ? '••••••••' : (value || '—')}</Text>
      </View>
    </View>
  )
}

function Figure({ value, label }) {
  return (
    <View style={styles.ep79}>
      <Text style={styles.ep80}>{value}</Text>
      <Text style={styles.ep58} numberOfLines={1}>{label}</Text>
    </View>
  )
}

export function ContractorProfileSheet({ contractor, profile, onClose, onRequestJoin, requestState, message }) {
  const { t, td } = useLanguage()
  const data = profile || contractor || {}
  const contactVisible = Boolean(profile?.can_view_contact)
  return (
    <SheetModal visible={Boolean(contractor)} title={t('dash.contractor.builderProfile')} onClose={onClose} tall>
      <View style={styles.ep81}>
        <Image
          source={data.company_logo_url ? imageSource(data.company_logo_url) : userAvatarSource(data, 'CONTRACTOR')}
          style={{ width: 64, height: 64, borderRadius: 16 }}
          contentFit="cover"
        />
        <View style={styles.ep29}>
          <Text style={styles.ep82} numberOfLines={2}>{td(data.company_name)}</Text>
          <View style={styles.ep70}>
                       <Star size={13} color={ink('#d97706')} fill="#f59e0b" />
            <Text style={styles.ep83}>{ratingLabel(data.rating, data.review_count, t)}</Text>
          </View>
          <View style={styles.ep84}>
            <MapPin size={13} color={COLORS.brand[700]} />
            <Text style={styles.ep69} numberOfLines={2}>{[td(data.address || ''), data.pincode || ''].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.ep85}>
        <Figure value={`${data.experience_years || 0} ${t('dash.supplier.yrs')}`} label={t('dash.msg.experience')} />
        <Figure value={String(data.completed_projects || 0)} label={t('dash.supplier.projects')} />
        <Figure value={String(data.team_size || '—')} label={t('dash.contractor.teamSize')} />
      </View>

      {data.about ? <Text style={styles.ep86}>{td(data.about)}</Text> : null}

      {(data.services_offered || []).length > 0 ? (
        <View style={styles.ep87}>
          <Text style={styles.ep88}>{t('dash.msg.services')}</Text>
          <View style={styles.ep89}>
            {data.services_offered.map((service) => (
              <View key={service} style={styles.ep90}>
                <Text style={styles.ep91}>{SERVICE_OPTION_KEYS[service] ? t(SERVICE_OPTION_KEYS[service]) : td(service)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.ep92}>
        <InfoTile icon={Mail} label={t('dash.common.email')} value={data.email} blur={!contactVisible} />
        <InfoTile icon={Phone} label={t('dash.common.phone')} value={data.phone} blur={!contactVisible} />
      </View>

      {message ? <View style={styles.ep87}><Notice tone="info" text={message} /></View> : null}

      <View style={styles.ep93}>
              {requestState === 'active' ? (
          <View style={styles.ep94}>
            <CheckCircle2 size={16} color={ink('#047857')} />
            <Text style={styles.ep95}>{t('dash.engineer.activeTeamMember')}</Text>
          </View>
        ) : requestState === 'pending' ? (
          <View style={styles.ep96}>
            <Clock size={16} color={COLORS.brand[700]} />
            <Text style={styles.ep97}>{t('dash.engineer.joinRequestPending')}</Text>
          </View>
        ) : (
          <Pressable onPress={() => onRequestJoin(data.user_id || data.contractor_id || contractor?.user_id)} style={styles.ep98}>
            <UserRound size={16} color="#ffffff" />
            <Text style={styles.ep47}>{t('dash.engineer.requestToJoin')}</Text>
          </Pressable>
        )}
      </View>
    </SheetModal>
  )
}

export function OpportunitySheet({ opportunity, onClose, onApply, applied, message }) {
  const { t, td } = useLanguage()
  const item = opportunity || {}
  return (
    <SheetModal visible={Boolean(opportunity)} title={t('dash.engineer.opportunityDetails')} onClose={onClose}>
      <View style={styles.ep26}>
        <View style={styles.ep29}>
          <View style={styles.ep99}>
            <Text style={styles.ep100}>{t('dash.engineer.siteEngineerRequired')}</Text>
          </View>
          <Text style={styles.ep101}>{td(item.title)}</Text>
          <View style={styles.ep102}>
            <Building2 size={15} color={COLORS.brand[700]} />
            <Text style={styles.ep103}>{td(item.company_name)}</Text>
          </View>
        </View>
        <View style={styles.ep104}>
          <Text style={styles.ep105}>{money(item.budget, item.project_country)}</Text>
        </View>
      </View>
      <View style={styles.ep85}>
        <InfoTile icon={MapPin} label={t('dash.common.pincode')} value={item.pincode} />
        <InfoTile icon={FileText} label={t('dash.common.type')} value={constructionTypeLabel(item.construction_type, t) || '—'} />
      </View>
      {item.description ? <Text style={styles.ep86}>{td(item.description)}</Text> : null}
      {message ? <View style={styles.ep87}><Notice tone="info" text={message} /></View> : null}
      <View style={styles.ep93}>
        {applied ? (
          <View style={styles.ep94}>
                       <CheckCircle2 size={16} color={ink('#047857')} />
            <Text style={styles.ep95}>{t('dash.engineer.applicationSent')}</Text>
          </View>
        ) : (
          <Pressable onPress={() => onApply(item)} style={styles.ep98}>
            <Text style={styles.ep47}>{t('dash.engineer.applyForOpportunity')}</Text>
            <ArrowRight size={16} color="#ffffff" />
          </Pressable>
        )}
      </View>
    </SheetModal>
  )
}

const styles = createStyles((c) => ({
  ep1: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  ep2: { backgroundColor: c.mutedStrong },
  ep3: { backgroundColor: '#236645' },
  ep4: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  ep5: { color: c.textSecondary },
  ep6: { color: '#ffffff' },
  ep7: { flexDirection: 'row', alignItems: 'center', gap: 3.5, borderRadius: 9999, paddingHorizontal: 7, paddingVertical: 1.75 },
    ep8: { backgroundColor: soft('#ecfdf5', '#047857') },
  ep9: { backgroundColor: c.muted },
  ep10: { height: 5.25, width: 5.25, borderRadius: 9999 },
  ep11: { backgroundColor: '#10b981' },
  ep12: { backgroundColor: '#94a3b8' },
  ep13: { fontSize: 10, fontWeight: '700' },
    ep14: { color: ink('#047857') },
  ep15: { color: c.textMuted },
  ep16: { marginBottom: 10.5, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  ep17: { borderRadius: 9999, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  ep18: { fontSize: 11, fontWeight: '800' },
  ep19: { alignItems: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandBorderStrong, backgroundColor: c.card, paddingHorizontal: 17.5, paddingVertical: 28 },
  ep20: { marginTop: 7, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', fontSize: 16, lineHeight: 24, color: c.text },
  ep21: { marginTop: 3.5, textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '500', color: c.textMuted },
  ep22: { marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10.5 },
  ep23: { fontSize: 12, lineHeight: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  ep24: { fontSize: 10.5, fontWeight: '700' },
  ep25: { marginBottom: 10.5, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  ep26: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5 },
  ep27: { height: 38.5, width: 38.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, backgroundColor: c.brandSoft },
  ep28: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: c.brandTextStrong },
  ep29: { flex: 1 },
  ep30: { fontSize: 14, fontWeight: '800', color: c.text },
  ep31: { marginTop: 1.75, fontSize: 11.5, fontWeight: '600', color: c.textMuted },
  ep32: { marginTop: 8.75, flexDirection: 'row', flexWrap: 'wrap', gap: 5.25 },
  ep33: { marginTop: 8.75, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  ep34: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  ep35: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: c.text },
  ep36: { marginTop: 5.25, height: 5.25, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.mutedStrong },
  ep37: { height: '100%', borderRadius: 9999, backgroundColor: '#10b981' },
  ep38: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 7 },
  ep39: { flex: 1, fontSize: 10, fontWeight: '600', color: c.textMuted },
  ep40: { flexDirection: 'row', alignItems: 'center', gap: 1.75 },
  ep41: { fontSize: 10.5, fontWeight: '800', color: c.brandText },
  ep42: { height: 31.5, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12.25 },
  ep43: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.textSoft },
  ep44: { flexDirection: 'row', gap: 7 },
  ep45: { height: 35, flex: 1, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, lineHeight: 20, fontWeight: '600', color: c.text },
  ep46: { height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#236645', paddingHorizontal: 14 },
  ep47: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: '#ffffff' },
  ep48: { marginTop: 7 },
  ep49: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  ep50: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: c.textMuted },
  ep51: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  ep52: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  ep53: { marginTop: 7, flexDirection: 'row', gap: 7 },
  ep54: { height: 31.5, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 8, backgroundColor: '#1a5038' },
  ep55: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#ffffff' },
    ep56: { height: 31.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: line('#fecdd3', '#e11d48'), backgroundColor: c.card },
  ep57: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: ink('#e11d48') },
  ep58: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: c.textFaint },
  ep59: { fontSize: 11.5, fontWeight: '600', color: c.textMuted },
  ep60: { marginTop: 10.5, flexDirection: 'row' },
  ep61: { marginTop: 10.5, height: 31.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 9999, backgroundColor: '#1a5038' },
  ep62: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  ep63: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  ep64: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 14, paddingVertical: 10.5 },
  ep65: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  ep66: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '800', color: c.text },
  ep67: { borderRadius: 9999, backgroundColor: c.muted, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  ep68: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  ep69: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '500', color: c.textMuted },
  ep70: { marginTop: 1.75, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  ep71: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '500', color: c.textMuted },
  ep72: { marginTop: 8.75, flexDirection: 'row', gap: 7 },
  ep73: { height: 28, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  ep74: { height: 28, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 8, backgroundColor: soft('#ecfdf5', '#047857') },
  ep75: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: ink('#047857') },
  ep76: { height: 28, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 8, backgroundColor: '#236645' },
  ep77: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8.75, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 10.5 },
  ep78: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.textSoft },
  ep79: { flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 7, paddingVertical: 8.75 },
  ep80: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: c.text },
  ep81: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ep82: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, lineHeight: 28, color: c.text },
  ep83: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.brandText },
  ep84: { marginTop: 1.75, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  ep85: { marginTop: 14, flexDirection: 'row', gap: 7 },
  ep86: { marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 12.25, fontSize: 14, lineHeight: 20, fontWeight: '500', color: c.textSecondary },
  ep87: { marginTop: 14 },
  ep88: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: c.textFaint },
  ep89: { marginTop: 5.25, flexDirection: 'row', flexWrap: 'wrap', gap: 5.25 },
  ep90: { borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  ep91: { fontSize: 11, fontWeight: '800', color: c.brandTextStrong },
  ep92: { marginTop: 14, gap: 7 },
  ep93: { marginBottom: 7, marginTop: 10.5 },
  ep94: { height: 38.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: soft('#ecfdf5', '#047857') },
  ep95: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: ink('#047857') },
  ep96: { height: 38.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: c.brandSoft },
  ep97: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: c.brandText },
  ep98: { height: 38.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: '#236645' },
  ep99: { alignSelf: 'flex-start', borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  ep100: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: c.brandTextStrong },
  ep101: { marginTop: 7, fontFamily: 'Manrope_800ExtraBold', fontSize: 20, lineHeight: 28, color: c.text },
  ep102: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  ep103: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.textSecondary },
  ep104: { borderRadius: 9999, backgroundColor: c.muted, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  ep105: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: c.textSoft },
}))