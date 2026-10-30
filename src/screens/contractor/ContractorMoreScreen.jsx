// The Builder's "More" tab: every web sidebar / account-menu section that does
// not fit the five bottom tabs (web contractorConstants.baseNav + the account
// menu): Find Clients, Buy & Sell, Product Catalog, Portfolio, Plan & billing,
// Profile Settings, Messages and My Profile.
//
// Other screens open a section here with navigate('ContractorMoreTab', { section }).
// Labels use the web nav keys; mobile-only subtitles live in i18n/mobile/account.js.
import { useEffect, useState } from 'react'
import { BackHandler, View, Text, Pressable } from 'react-native'
import { createStyles } from '../../theme/createStyles'
import { useSelector } from 'react-redux'
import { useLanguage } from '../../i18n/LanguageContext'
import {
  Users, ShoppingBag, Search, Store, CircleUser, Package, Activity, CreditCard, Settings, MessageCircle, ChevronRight,
} from 'lucide-react-native'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import ContractorLeadsScreen from './ContractorLeadsScreen'
import BuilderProductCatalogScreen from './BuilderProductCatalogScreen'
import ShopHubScreen from '../shared/ShopHubScreen'
import PropertyMarketSection from '../shared/PropertyMarketSection'
import ProfileScreen from '../shared/ProfileScreen'
import DashboardShell, { ShellBackBar, useAsyncData } from '../../components/DashboardShell'
import PropertySellSection from '../../components/builder/PropertySellSection'
import { Section, SegmentTabs, PremiumBadge } from '../../components/builder/BuilderUi'
import useBuilderSubscription from '../../hooks/useBuilderSubscription'
import { useBuilderInbox, useMarkSectionRead } from '../../components/builder/BuilderInbox'
import { fetchOwnerProjects } from '../../api/projects'

// Each card's icon colour (light values; tint.js gives the dark ones).
const TONES = {
  sky: { bg: '#f0f9ff', border: '#bae6fd', fg: '#0369a1' },
  violet: { bg: '#f5f3ff', border: '#ddd6fe', fg: '#6d28d9' },
  emerald: { bg: '#ecfdf5', border: '#a7f3d0', fg: '#047857' },
  blue: { bg: '#eff6ff', border: '#bfdbfe', fg: '#1d4ed8' },
  amber: { bg: '#fffbeb', border: '#fde68a', fg: '#b45309' },
  slate: { bg: '#f8fafc', border: '#e2e8f0', fg: '#475569' },
  orange: { bg: '#fff7ed', border: '#fed7aa', fg: '#ea580c' },
  brand: { bg: '#f0f6f2', border: '#c3dccd', fg: '#1a5038' },
}

const MENU = [
  { id: 'clients', titleKey: 'ui.findClients', subtitleKey: 'mobile.account.more.sub.clients', Icon: Search, tone: TONES.sky },
  { id: 'shop', titleKey: 'ui.buySell', subtitleKey: 'mobile.account.more.sub.shop', Icon: ShoppingBag, tone: TONES.violet },
  { id: 'catalog', titleKey: 'ui.productCatalog', subtitleKey: 'mobile.account.more.sub.catalog', Icon: Package, tone: TONES.emerald },
  { id: 'portfolio', titleKey: 'subscription.portfolio.nav', subtitleKey: 'mobile.account.more.sub.portfolio', Icon: Activity, route: 'BuilderPortfolio', tone: TONES.blue },
  { id: 'subscription', titleKey: 'subscription.panel.menu', subtitleKey: 'mobile.account.more.sub.subscription', Icon: CreditCard, route: 'BuilderSubscription', tone: TONES.amber },
  { id: 'settings', titleKey: 'ui.profileSettings', subtitleKey: 'mobile.account.more.sub.settings', Icon: Settings, route: 'BuilderProfileSettings', tone: TONES.slate },
  { id: 'messages', titleKey: 'ui.messages', subtitleKey: 'mobile.account.more.sub.messages', Icon: MessageCircle, route: 'Messages', tone: TONES.orange },
  { id: 'profile', titleKey: 'mobile.account.more.myProfile', subtitleKey: 'mobile.account.more.sub.profile', Icon: CircleUser, tone: TONES.brand },
]

const STACK_SECTIONS = Object.fromEntries(MENU.filter((item) => item.route).map((item) => [item.id, item.route]))

function BuySellSection({ navigation }) {
  const { t } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  // Buy & Sell opens on Sell for a Builder, as on the web.
  const [tab, setTab] = useState('sell')
  const projects = useAsyncData(() => fetchOwnerProjects().catch(() => []), [])
  const projectList = Array.isArray(projects.data) ? projects.data : []
  const buySellTabs = [
    // Web order: Buy, then Sell (it still opens on Sell).
    { id: 'buy', label: t('property.tab.buy'), icon: Search },
    { id: 'sell', label: t('property.tab.sell'), icon: Store },
    { id: 'materials', label: t('site.estimate.result.materials'), icon: ShoppingBag },
  ]
  const tabs = (
    <Section>
      <SegmentTabs
        tabs={buySellTabs}
        active={tab}
        onChange={setTab}
      />
    </Section>
  )
  if (tab === 'materials') {
    // The existing mobile materials hub, unchanged.
    return (
      <ShellBackBar extra={<SegmentTabs tabs={buySellTabs} active={tab} onChange={setTab} />}>
        <ShopHubScreen
          navigation={navigation}
          loadProjects={fetchOwnerProjects}
          pickCheckoutProject={(list) => list[0] || null}
        />
      </ShellBackBar>
    )
  }
  return (
    <DashboardShell
      refreshing={false}
      onRefresh={() => projects.reload()}
      onOpenNotifications={() => navigation.navigate('Notifications')}
    >
      {tabs}
      {tab === 'sell'
        ? <PropertySellSection projects={projectList} defaultCountry={user?.country_of_residence || 'India'} />
        : <PropertyMarketSection />}
    </DashboardShell>
  )
}

export default function ContractorMoreScreen({ navigation, route }) {
  const { t } = useLanguage()
  const [section, setSection] = useState(null)
  const { status } = useBuilderSubscription()
  const inbox = useBuilderInbox()
  // The web sidebar's badges for the sections that live here.
  const menuBadges = {
    clients: inbox.unseenClients || inbox.notificationCounts?.findClients || 0,
    messages: inbox.unreadMessages || 0,
    profile: inbox.notificationCounts?.profile || 0,
  }

  // Deep link from other tabs: navigate('ContractorMoreTab', { section }).
  const requested = route?.params?.section
  useEffect(() => {
    if (!requested) return
    if (STACK_SECTIONS[requested]) navigation.navigate(STACK_SECTIONS[requested])
    else setSection(requested)
    navigation.setParams?.({ section: undefined })
  }, [requested, navigation])

  const closeSection = () => setSection(null)
  // Android back closes an open section first, like the on-screen arrow.
  useEffect(() => {
    if (!section) return undefined
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setSection(null); return true })
    return () => sub.remove()
  }, [section])

  const open = (item) => {
    if (item.route) navigation.navigate(item.route)
    else setSection(item.id)
  }

  if (section === 'clients') {
    return (
      <ShellBackBar title={t('ui.findClients')} onBack={closeSection}>
        <SectionReader id="findClients" />
        <ContractorLeadsScreen navigation={navigation} />
      </ShellBackBar>
    )
  }

  if (section === 'shop') {
    return (
      <ShellBackBar title={t('ui.buySell')} onBack={closeSection}>
        <BuySellSection navigation={navigation} />
      </ShellBackBar>
    )
  }

  if (section === 'catalog') {
    return (
      <ShellBackBar title={t('ui.productCatalog')} onBack={closeSection}>
        <BuilderProductCatalogScreen navigation={navigation} />
      </ShellBackBar>
    )
  }

  if (section === 'profile') {
    return (
      <ShellBackBar title={t('mobile.account.more.myProfile')} onBack={closeSection}>
        <SectionReader id="profile" />
        <ProfileScreen navigation={navigation} />
      </ShellBackBar>
    )
  }

  return (
    <DashboardShell onOpenNotifications={() => navigation.navigate('Notifications')}>
      <View style={styles.content}>
      <Text style={styles.eyebrow}>{t('mobile.account.more.eyebrow')}</Text>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{t('mobile.tab.more')}</Text>
        <PremiumBadge status={status} />
      </View>
      <Text style={styles.description}>
        {t('mobile.account.more.description')}
      </Text>

      {/* The 8 sections as 8 separate cards, two per row (web sidebar items). */}
      <View style={styles.grid}>
        {MENU.map((item) => {
          const { id, titleKey, subtitleKey, Icon, tone } = item
          const count = menuBadges[id] || 0
          return (
            <Pressable
              key={id}
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={t(titleKey)}
                        style={styles.card}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: soft(tone.bg, tone.fg), borderColor: line(tone.border, tone.fg) }]}>
                  <Icon size={20} color={ink(tone.fg)} />
                </View>
                {count > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                  </View>
                ) : (
                  <ChevronRight size={17} color={COLORS.slate[400]} />
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{t(titleKey)}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={3}>{t(subtitleKey)}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.note}>
        <Users size={19} color={COLORS.brand[700]} />
        <Text style={styles.noteText}>
          {t('mobile.account.more.partnersNote')}
        </Text>
      </View>
      </View>
    </DashboardShell>
  )
}

// Clears a More section's notification badge while it is open (web parity).
function SectionReader({ id }) {
  useMarkSectionRead(id)
  return null
}

const styles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.canvas },
  content: { paddingHorizontal: 16 },
  eyebrow: { color: c.brandText, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 4 },
  headingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  heading: { color: c.text, fontSize: 26, fontWeight: '800', flexShrink: 1 },
  description: { color: c.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginBottom: 14 },
  card: {
    width: '48.5%',
    minHeight: 148,
    backgroundColor: c.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: c.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  cardSubtitle: { color: c.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  badge: {
    minWidth: 20,
    height: 20,
    flexShrink: 0,
    borderRadius: 10,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.brandSoft, padding: 12, borderRadius: 12, marginTop: 6 },
  noteText: { flex: 1, minWidth: 0, color: c.textSecondary, fontSize: 11, lineHeight: 16 },
}))