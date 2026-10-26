// Port of the web ContractorProfileDetails (the pop-up House Owner > Find
// Builders opens): a builder's public profile with its seven tabs. Contact
// details, business identifiers and document files stay locked until a request
// between the two is accepted (`can_view_contact` / `can_view_documents`).
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, Linking, KeyboardAvoidingView } from 'react-native'
import { Image } from 'expo-image'
import {
  BadgeCheck, Building2, BriefcaseBusiness, Download, FileText, Globe, HardHat, House as Home, Lock, Mail, MapPin,
  MessageSquare, Phone, Star,
} from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenHeader from '../../components/ScreenHeader'
import { ContentWrap } from '../../components/Responsive'
import { PanelState, InsetArea } from '../../components/DashboardShell'
import { FormNotice, TextField } from '../../components/form'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { fetchContractorProfile } from '../../api/profiles'
import { sendConversationMessage, startConversation } from '../../api/messages'
import { imageSource, imageUrl } from '../../api/client'
import { avatarFromPath } from '../../utils/avatars'
import { hasRating, ratingLabel } from '../../utils/ratingLabel'
import { BUSINESS_TYPE_KEYS, DOCUMENT_TYPE_KEYS, EQUIPMENT_OPTION_KEYS, SERVICE_OPTION_KEYS, optionLabel } from '../../i18n/optionKeys'
import { COLORS } from '../../theme/tokens'
import { apiDetail } from './ownerHelpers'
import { createStyles } from '../../theme/createStyles'

const TABS = ['overview', 'projects', 'reviews', 'services', 'documents', 'gallery', 'equipment']
const TAB_LABEL_KEYS = {
  overview: 'ui.overview',
  projects: 'ui.projects',
  reviews: 'ui.contractor.tabReviews',
  services: 'dash.msg.services',
  documents: 'ps.documents',
  gallery: 'cps.gallery',
  equipment: 'dash.engineer.analytics.equipment',
}

function InfoCard({ title, children }) {
  return (
    <View style={styles.view}>
      <Text style={[styles.text, { fontSize: 14.5 }]}>{title}</Text>
      <View style={styles.view2}>{children}</View>
    </View>
  )
}

function EmptyPanel({ title, message }) {
  return (
    <View style={styles.view3}>
      <Text style={[styles.text2, { fontSize: 13.5 }]}>{title}</Text>
      <Text style={[styles.text3, { fontSize: 12 }]}>{message}</Text>
    </View>
  )
}

function DetailLine({ label, value }) {
  const { t } = useLanguage()
  return (
    <View style={[styles.view4, { gap: 16 }]}>
      <Text style={[styles.text4, { fontSize: 12.5 }]}>{label}</Text>
      <Text style={[styles.text5, { fontSize: 12.5 }]}>{value || t('cpp.notSet')}</Text>
    </View>
  )
}

function Tile({ icon: Icon, label }) {
  return (
    <View style={[styles.view5, { gap: 8, flexBasis: '48%', flexGrow: 1 }]}>
      <Icon size={16} color={COLORS.brand[700]} />
      <Text style={[styles.text6, { fontSize: 12.5 }]}>{label}</Text>
    </View>
  )
}

// A stored document entry is "<Type>: <url>", or a bare "<url>" from an older upload.
function splitDocumentEntry(documentName) {
  const entry = String(documentName || '').trim()
  if (entry.startsWith('/') || entry.startsWith('http')) return { type: '', url: entry }
  const separatorIndex = entry.indexOf(': ')
  if (separatorIndex < 0) return { type: entry, url: '' }
  return { type: entry.slice(0, separatorIndex).trim(), url: entry.slice(separatorIndex + 2).trim() }
}

function documentUrl(documentName) {
  const url = splitDocumentEntry(documentName).url
  return url.startsWith('/files/') || url.startsWith('/uploads/') || url.startsWith('http') ? url : ''
}

export default function BuilderProfileScreen({ navigation, route }) {
  // Full-screen pages draw under the Android navigation buttons; keep the end clear of them.
  const insets = useSafeAreaInsets()
  const { t, td } = useLanguage()
  const { gutter } = useResponsive()
  const contractorId = route?.params?.contractorId
  const [profile, setProfile] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [composerOpen, setComposerOpen] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [messageStatus, setMessageStatus] = useState('')
  const [messageSending, setMessageSending] = useState(false)

  useEffect(() => {
    fetchContractorProfile(contractorId)
      .then(setProfile)
      .catch((error) => setErrorMessage(apiDetail(error, t('cpd.errLoadProfile'))))
  }, [contractorId, t])

  const title = profile ? td(profile.company_name || profile.name) : t('dash.contractor.loadingProfile')

  if (!profile) {
    return (
      <View style={styles.view6}>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <View style={styles.view7}>
          <PanelState loading={!errorMessage} error={errorMessage}>{null}</PanelState>
        </View>
      </View>
    )
  }

  const servicesOffered = profile.services_offered || []
  const serviceLocations = profile.service_locations || []
  const equipmentOwned = profile.equipment_owned || []
  const documentList = profile.documents || []
  const documentTypes = profile.document_types || []
  const completedProjects = profile.completed_project_details || []
  const gallery = profile.gallery || []
  const reviews = Array.isArray(profile.reviews) ? profile.reviews : []
  const contactUnlocked = profile.can_view_contact !== false
  const documentsUnlocked = profile.can_view_documents !== false
  const reviewCount = Number(profile.review_count || 0)
  const businessTypeLabel = profile.business_type ? optionLabel(t, BUSINESS_TYPE_KEYS, profile.business_type) : ''

  const sendDirectMessage = async () => {
    if (!contactUnlocked) {
      setMessageStatus(t('dash.owner.supplierModal.unlockNote'))
      return
    }
    if (!messageBody.trim()) {
      setMessageStatus(t('dash.contractor.typeMessage'))
      return
    }
    setMessageSending(true)
    setMessageStatus('')
    try {
      const conversation = await startConversation({ receiver_id: profile.user_id, title: profile.company_name || profile.name })
      await sendConversationMessage({ conversation_id: conversation.id, body: messageBody.trim() })
      setMessageBody('')
      setMessageStatus(t('dash.contractor.messageSent'))
    } catch (error) {
      setMessageStatus(apiDetail(error, t('cpd.errSendMessage')))
    } finally {
      setMessageSending(false)
    }
  }

  const renderTab = () => {
    if (activeTab === 'overview') {
      return (
        <>
          <InfoCard title={t('dash.contractor.aboutBuilder')}>
            <Text style={[styles.text7, { fontSize: 13, lineHeight: 20 }]}>
              {td(profile.about) || t('dash.contractor.noCompanyDescription')}
            </Text>
          </InfoCard>
          <InfoCard title={t('dash.contractor.keyInformation')}>
            <DetailLine label={t('dash.owner.supplierModal.businessType')} value={businessTypeLabel} />
            <DetailLine label={t('dash.owner.supplierModal.registrationYear')} value={profile.registration_year ? String(profile.registration_year) : ''} />
            <DetailLine label={t('dash.contractor.teamSize')} value={profile.team_size ? String(profile.team_size) : ''} />
            <DetailLine label={t('dash.contractor.insurance')} value={profile.insurance_available ? t('dash.common.yes') : t('dash.common.no')} />
            {/* Business identifiers are shared once a request is accepted. */}
            <DetailLine label={t('dash.contractor.license')} value={contactUnlocked ? profile.license_number : t('cpd.privateAfterAccept')} />
            <DetailLine label={t('dash.owner.supplierModal.gstin')} value={contactUnlocked ? profile.gstin : t('cpd.privateAfterAccept')} />
            <DetailLine label={t('dash.owner.supplierModal.pan')} value={contactUnlocked ? profile.pan : t('cpd.privateAfterAccept')} />
            <DetailLine label={t('dash.owner.supplierModal.website')} value={contactUnlocked ? profile.website : t('cpd.privateAfterAccept')} />
            <DetailLine label={t('dash.common.pincode')} value={profile.pincode} />
          </InfoCard>
        </>
      )
    }
    if (activeTab === 'projects') {
      return (
        <InfoCard title={t('dash.contractor.completedProjects')}>
          {completedProjects.length ? (
            <View style={{ gap: 10 }}>
              {completedProjects.map((project, index) => {
                const images = Array.isArray(project.images) ? project.images : []
                return (
                  <View key={`${project.title}-${index}`} style={styles.view8}>
                    {images.length ? (
                      <View style={[styles.view9, { gap: 2 }]}>
                        {images.slice(0, 4).map((image) => (
                          <Image
                            key={image}
                            source={imageSource(image)}
                            style={{ width: images.length > 1 ? '49.5%' : '100%', height: images.length > 1 ? 90 : 150 }}
                            contentFit="cover"
                          />
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.view10}>
                      <Text style={[styles.text8, { fontSize: 13 }]}>
                        {td(project.title) || t('dash.contractor.completedProjectN', { n: index + 1 })}
                      </Text>
                      {project.location ? (
                        <View style={[styles.view11, { gap: 4 }]}>
                          <MapPin size={12} color={COLORS.slate[400]} />
                          <Text style={[styles.text9, { fontSize: 11.5 }]}>{td(project.location)}</Text>
                        </View>
                      ) : null}
                      {project.description ? (
                        <Text style={[styles.text10, { fontSize: 11.5, lineHeight: 17 }]}>{td(project.description)}</Text>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <EmptyPanel title={t('dash.contractor.noCompletedProjects')} message={t('dash.contractor.noCompletedProjectsSub')} />
          )}
        </InfoCard>
      )
    }
    if (activeTab === 'reviews') {
      return (
        <>
          <InfoCard title={t('dash.contractor.customerRating')}>
            <View style={styles.view12}>
              <Text style={[styles.text, { fontSize: 30 }]}>{ratingLabel(profile.rating, profile.review_count, t)}</Text>
              {reviewCount > 0 ? (
                <Text style={[styles.text11, { fontSize: 12.5 }]}>{t('cpd.reviewCount', { count: reviewCount })}</Text>
              ) : null}
              <Text style={[styles.text12, { fontSize: 11.5 }]}>{t('dash.contractor.reviewsAfterCompletion')}</Text>
            </View>
          </InfoCard>
          <InfoCard title={t('dash.contractor.customerReviews')}>
            {reviews.length ? (
              <View style={{ gap: 8 }}>
                {reviews.map((review, index) => (
                  <View key={`${review.created_at}-${index}`} style={styles.view13}>
                    <View style={[styles.view14, { gap: 8 }]}>
                      <Text style={[styles.text6, { fontSize: 13 }]}>{td(review.reviewer_name)}</Text>
                      <View style={[styles.view15, { gap: 3 }]}>
                        <Star size={12} color="#d97706" fill="#d97706" />
                        <Text style={[styles.text13, { fontSize: 12 }]}>{String(review.rating)}</Text>
                      </View>
                    </View>
                    {review.comment ? (
                      <Text style={[styles.text14, { fontSize: 12, lineHeight: 17 }]}>{td(review.comment)}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyPanel title={t('dash.contractor.noReviews')} message={t('dash.contractor.noReviewsSub')} />
            )}
          </InfoCard>
        </>
      )
    }
    if (activeTab === 'services') {
      return (
        <>
          <InfoCard title={t('ps.con.servicesOffered')}>
            {servicesOffered.length ? (
              <View style={[styles.view9, { gap: 8 }]}>
                {servicesOffered.map((service) => <Tile key={service} icon={Home} label={optionLabel(t, SERVICE_OPTION_KEYS, service)} />)}
              </View>
            ) : (
              <EmptyPanel title={t('cpd.noServices')} message={t('cpd.servicesEmpty')} />
            )}
          </InfoCard>
          <InfoCard title={t('ps.con.serviceLocations')}>
            {serviceLocations.length ? (
              <View style={[styles.view9, { gap: 6 }]}>
                {serviceLocations.map((location) => (
                  <View key={location} style={[styles.view16, { gap: 5 }]}>
                    <MapPin size={13} color={COLORS.brand[700]} />
                    <Text style={[styles.text15, { fontSize: 12 }]}>{td(location)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyPanel title={t('cpd.noLocations')} message={t('cpd.locationsEmpty')} />
            )}
          </InfoCard>
        </>
      )
    }
    if (activeTab === 'documents') {
      return (
        <InfoCard title={t('cpd.documentsCerts')}>
          {!documentsUnlocked && documentTypes.length ? (
            // Which documents the builder holds is public; the files open once a request is accepted.
            <View style={{ gap: 8 }}>
              {documentTypes.map((documentType) => (
                <View key={documentType} style={styles.pressable}>
                  <View style={[styles.view15, { gap: 6 }]}>
                    <FileText size={15} color={COLORS.slate[500]} />
                    <Text style={[styles.text8, { fontSize: 12.5 }]}>
                      {DOCUMENT_TYPE_KEYS[documentType] ? t(DOCUMENT_TYPE_KEYS[documentType]) : td(documentType)}
                    </Text>
                  </View>
                  <Lock size={15} color={COLORS.slate[400]} />
                </View>
              ))}
              <FormNotice message={t('cpd.documentsLocked')} />
            </View>
          ) : documentList.length ? (
            <View style={{ gap: 8 }}>
              {documentList.map((documentName) => {
                const href = documentUrl(documentName)
                const type = splitDocumentEntry(documentName).type
                const label = !type ? t('cps.documentType') : DOCUMENT_TYPE_KEYS[type] ? t(DOCUMENT_TYPE_KEYS[type]) : td(type)
                return (
                  <Pressable
                    key={documentName}
                    disabled={!href}
                    onPress={() => href && Linking.openURL(imageUrl(href))}
                    style={styles.pressable}
                  >
                    <View style={[styles.view15, { gap: 6 }]}>
                      <FileText size={15} color={COLORS.slate[500]} />
                      <Text style={[styles.text8, { fontSize: 12.5 }]}>{label}</Text>
                    </View>
                    <Download size={15} color={COLORS.brand[700]} />
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <EmptyPanel title={t('cpd.noDocuments')} message={t('cpd.documentsEmpty')} />
          )}
        </InfoCard>
      )
    }
    if (activeTab === 'gallery') {
      return (
        <InfoCard title={t('cpd.projectGallery')}>
          {gallery.length ? (
            <View style={[styles.view9, { gap: 6 }]}>
              {gallery.map((item) => (
                <Image key={item} source={imageSource(item)} style={{ width: '31.8%', aspectRatio: 1, borderRadius: 12 }} contentFit="cover" />
              ))}
            </View>
          ) : (
            <EmptyPanel title={t('cpd.noGallery')} message={t('cpd.galleryEmpty')} />
          )}
        </InfoCard>
      )
    }
    return (
      <InfoCard title={t('ps.con.equipmentOwned')}>
        {equipmentOwned.length ? (
          <View style={[styles.view9, { gap: 8 }]}>
            {equipmentOwned.map((item) => <Tile key={item} icon={Building2} label={optionLabel(t, EQUIPMENT_OPTION_KEYS, item)} />)}
          </View>
        ) : (
          <EmptyPanel title={t('cpd.noEquipment')} message={t('cpd.equipmentEmpty')} />
        )}
      </InfoCard>
    )
  }

  const contactLine = (Icon, value) => (value ? (
    <View style={[styles.view15, { gap: 5 }]}>
      <Icon size={13} color={COLORS.brand[700]} />
      <Text style={[styles.text16, { fontSize: 12 }]} numberOfLines={1}>{value}</Text>
    </View>
  ) : null)

  return (
    <View style={styles.view6}>
      <ScreenHeader title={title} subtitle={td(profile.name)} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 40 + insets.bottom }}>
          <ContentWrap>
          <InsetArea>
            <View style={styles.view}>
              <View style={[styles.view17, { gap: 12 }]}>
                <Image source={avatarFromPath(profile.profile_image_url, 'CONTRACTOR')} style={{ width: 60, height: 60, borderRadius: 30 }} contentFit="cover" />
                <View style={styles.view18}>
                  <View style={[styles.view19, { gap: 6 }]}>
                    {profile.company_logo_url ? (
                      <Image source={imageSource(profile.company_logo_url)} style={{ width: 22, height: 22, borderRadius: 6 }} contentFit="cover" />
                    ) : null}
                    <Text style={[styles.text17, { fontSize: 16 }]}>{td(profile.company_name)}</Text>
                    {profile.is_verified === true ? (
                      <View style={[styles.view20, { gap: 3 }]}>
                        <BadgeCheck size={11} color={COLORS.brand[700]} />
                        <Text style={[styles.text15, { fontSize: 10 }]}>{t('dash.common.verified')}</Text>
                      </View>
                    ) : !profile.profile_complete ? (
                      <View style={styles.view21}>
                        <Text style={[styles.text18, { fontSize: 10 }]}>{t('dash.contractor.profilePending')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.text9, { fontSize: 11.5 }]}>
                    {[td(profile.name), businessTypeLabel].filter(Boolean).join(' · ')}
                  </Text>
                  <View style={[styles.view22, { gap: 10 }]}>
                    <View style={[styles.view15, { gap: 3 }]}>
                      <Star size={12} color="#d97706" fill="#d97706" />
                      <Text style={[styles.text13, { fontSize: 11.5 }]}>
                        {hasRating(profile.rating, profile.review_count) ? ratingLabel(profile.rating, profile.review_count, t) : t('dash.common.new')}
                      </Text>
                    </View>
                    <View style={[styles.view15, { gap: 3 }]}>
                      <HardHat size={12} color={COLORS.brand[700]} />
                      <Text style={[styles.text7, { fontSize: 11.5 }]}>{t('ui.contractor.yearsExperiencePlus', { years: profile.experience_years || 0 })}</Text>
                    </View>
                    <View style={[styles.view15, { gap: 3 }]}>
                      <BriefcaseBusiness size={12} color={COLORS.brand[700]} />
                      <Text style={[styles.text7, { fontSize: 11.5 }]}>{`${completedProjects.length} ${t('cpd.projectsCompleted')}`}</Text>
                    </View>
                  </View>
                  <View style={[styles.view11, { gap: 3 }]}>
                    <MapPin size={12} color={COLORS.brand[700]} />
                    <Text style={[styles.text19, { fontSize: 11.5 }]}>
                      {contactUnlocked && profile.address ? `${td(profile.address)} - ${profile.pincode || ''}` : profile.pincode}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.view23, { gap: 5 }]}>
                {contactUnlocked ? (
                  <>
                    {contactLine(Phone, profile.phone)}
                    {contactLine(Mail, profile.email)}
                    {contactLine(Globe, profile.website)}
                  </>
                ) : (
                  <View style={[styles.view15, { gap: 5 }]}>
                    <Lock size={13} color={COLORS.brand[800]} />
                    <Text style={[styles.text20, { fontSize: 12 }]}>{t('cpd.contactLocked')}</Text>
                  </View>
                )}
                <Pressable
                  disabled={!contactUnlocked}
                  onPress={() => setComposerOpen((open) => !open)}
                  style={[styles.pressable2, contactUnlocked ? styles.pressable3 : styles.pressable4, { gap: 6 }]}
                >
                  <MessageSquare size={15} color="#ffffff" />
                  <Text style={[styles.text21, { fontSize: 12.5 }]}>{t('cpd.sendMessage')}</Text>
                </Pressable>
                {contactUnlocked && composerOpen ? (
                  <View style={styles.view24}>
                    <TextField
                      value={messageBody}
                      onChangeText={setMessageBody}
                      placeholder={t('ui.contractor.messageTo', { name: td(profile.company_name || profile.name) })}
                      multiline
                      style={{ minHeight: 80 }}
                    />
                    <Pressable
                      onPress={sendDirectMessage}
                      disabled={messageSending}
                      style={[styles.pressable5, messageSending ? styles.pressable6 : null]}
                    >
                      <Text style={[styles.text21, { fontSize: 12.5 }]}>{messageSending ? t('cpp.sending') : t('cpd.send')}</Text>
                    </Pressable>
                    {messageStatus ? <Text style={[styles.text22, { fontSize: 12 }]}>{messageStatus}</Text> : null}
                  </View>
                ) : null}
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.scrollView}
              contentContainerStyle={{ paddingHorizontal: 6 }}
            >
              {TABS.map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.pressable7, styles[activeTab === tab ? 'pressable8' : 'border-transparent']]}
                >
                  <Text style={[styles.text23, activeTab === tab ? styles.text24 : styles.text25, { fontSize: 12.5 }]}>
                    {t(TAB_LABEL_KEYS[tab])}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {renderTab()}
          </InsetArea>
          </ContentWrap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 10.5, borderRadius: 14, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card, padding: 12.25 },
  text: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view2: { marginTop: 8.75 },
  view3: { alignItems: 'center', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandBorder, backgroundColor: c.brandSoft40, padding: 14 },
  text2: { textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.text },
  text3: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
  view4: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.brandBorderSoft, paddingVertical: 7 },
  text4: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  text5: { flex: 1, textAlign: 'right', fontFamily: 'Inter_700Bold', color: c.text },
  view5: { flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card, padding: 8.75 },
  text6: { flex: 1, fontFamily: 'Inter_700Bold', color: c.text },
  view6: { flex: 1, backgroundColor: c.canvas },
  view7: { padding: 17.5 },
  text7: { fontFamily: 'Inter_400Regular', color: c.textSecondary },
  view8: { overflow: 'hidden', borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card },
  view9: { flexDirection: 'row', flexWrap: 'wrap' },
  view10: { padding: 10.5 },
  text8: { fontFamily: 'Inter_700Bold', color: c.text },
  view11: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center' },
  text9: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  text10: { marginTop: 5.25, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view12: { alignItems: 'center' },
  text11: { marginTop: 3.5, fontFamily: 'Inter_700Bold', color: c.amberTextSoft },
  text12: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textFaint },
  view13: { borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card, padding: 10.5 },
  view14: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  view15: { flexDirection: 'row', alignItems: 'center' },
  text13: { fontFamily: 'Inter_700Bold', color: c.amberTextSoft },
  text14: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view16: { flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  text15: { fontFamily: 'Inter_700Bold', color: c.brandText },
  pressable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 10.5 },
  text16: { fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  view17: { flexDirection: 'row', alignItems: 'flex-start' },
  view18: { flex: 1 },
  view19: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  text17: { flexShrink: 1, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view20: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 7, paddingVertical: 1.75 },
  view21: { borderRadius: 9999, backgroundColor: c.muted, paddingHorizontal: 7, paddingVertical: 1.75 },
  text18: { fontFamily: 'Inter_700Bold', color: c.textSecondary },
  view22: { marginTop: 5.25, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  text19: { flex: 1, fontFamily: 'Inter_400Regular', color: c.textSecondary },
  view23: { marginTop: 10.5, borderTopWidth: 1, borderColor: c.brandBorderSoft, paddingTop: 8.75 },
  text20: { flex: 1, fontFamily: 'Inter_600SemiBold', color: c.brandTextStrong },
  pressable2: { marginTop: 5.25, height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10.5 },
  pressable3: { backgroundColor: '#1a5038' },
  pressable4: { backgroundColor: c.mutedStronger },
  text21: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view24: { marginTop: 7, borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft40, padding: 8.75 },
  pressable5: { height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable6: { opacity: 0.6 },
  text22: { marginTop: 7, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  scrollView: { marginBottom: 10.5, borderRadius: 14, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card },
  pressable7: { borderBottomWidth: 2, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  pressable8: { borderColor: '#1a5038' },
  text23: { fontFamily: 'Inter_700Bold' },
  text24: { color: c.brandTextStrong },
  text25: { color: c.textFaint },
}))
