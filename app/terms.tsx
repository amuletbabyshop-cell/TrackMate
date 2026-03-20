// app/terms.tsx — 利用規約
import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BG_GRADIENT, TEXT } from '../lib/theme'

const LAST_UPDATED = '2025年3月'
const APP_NAME     = 'TrackMate'
const CONTACT      = 'fojpl.office@gmail.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}
function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.body}>{children}</Text>
}
function Li({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.liRow}>
      <Text style={s.bullet}>・</Text>
      <Text style={[s.body, { flex: 1 }]}>{children}</Text>
    </View>
  )
}

export default function TermsScreen() {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>利用規約</Text>
          <Text style={s.meta}>{APP_NAME} / 最終更新：{LAST_UPDATED}</Text>

          <Section title="第1条（総則）">
            <P>
              本利用規約（以下「本規約」）は、{APP_NAME}（以下「本サービス」）の利用条件を定めるものです。
              ユーザーの皆さまには、本規約に同意いただいたうえで本サービスをご利用いただきます。
            </P>
          </Section>

          <Section title="第2条（サービスの内容）">
            <P>本サービスは以下の機能を提供します。</P>
            <Li>練習記録・トレーニングデータの管理</Li>
            <Li>AIを活用したフォーム動画分析（Claude API 使用）</Li>
            <Li>AIによる食事・栄養管理のアドバイス</Li>
            <Li>怪我リスクスコアの算出と怪我予防のサポート</Li>
            <Li>リカバリー・テーピングに関する医学的情報の提供</Li>
          </Section>

          <Section title="第3条（利用プラン）">
            <P>本サービスは以下のプランを提供します。</P>
            <Li>
              <Text style={s.bold}>無料プラン</Text>
              {' — '}基本機能を無料で利用できます。動画分析は1日2回まで（広告視聴で追加可）。広告が表示されます。
            </Li>
            <Li>
              <Text style={s.bold}>プレミアムプラン（¥490/月）</Text>
              {' — '}広告なし・動画分析無制限・高精度AIモデル（Claude Opus）を利用できます。
            </Li>
          </Section>

          <Section title="第4条（禁止事項）">
            <P>ユーザーは以下の行為を行ってはなりません。</P>
            <Li>本サービスを違法な目的に使用すること</Li>
            <Li>他のユーザーや第三者の権利を侵害すること</Li>
            <Li>本サービスのシステムに不正にアクセスすること</Li>
            <Li>虚偽の情報を登録・送信すること</Li>
            <Li>本サービスを商業目的で無断転用すること</Li>
            <Li>本サービスの運営を妨害する行為</Li>
          </Section>

          <Section title="第5条（医療免責事項）">
            <P>
              本サービスが提供する怪我予防・リカバリー・栄養に関する情報は、一般的な参考情報です。
              医師・トレーナーなど専門家の診断・アドバイスに代わるものではありません。
              症状が重い場合や継続する場合は、必ず医療機関を受診してください。
            </P>
            <P>
              本サービスの情報を参考にした行動によって生じた損害について、運営者は責任を負いかねます。
            </P>
          </Section>

          <Section title="第6条（サービスの変更・停止）">
            <P>
              運営者は、ユーザーへの事前通知なしに本サービスの内容を変更、または提供を停止することがあります。
              これによってユーザーに生じた損害について、運営者は責任を負いかねます。
            </P>
          </Section>

          <Section title="第7条（プレミアムプランの解約）">
            <Li>プレミアムプランはいつでも解約できます</Li>
            <Li>解約後も当月末まで利用可能です</Li>
            <Li>日割りでの返金は行いません</Li>
            <Li>解約方法：設定 → サブスクリプション → 解約</Li>
          </Section>

          <Section title="第8条（知的財産権）">
            <P>
              本サービスに含まれるコンテンツ・デザイン・ロゴ等の知的財産権は運営者に帰属します。
              ユーザーが入力したデータの権利はユーザーに帰属します。
            </P>
          </Section>

          <Section title="第9条（準拠法・管轄裁判所）">
            <P>
              本規約は日本法に準拠します。
              本サービスに関する紛争については、運営者所在地を管轄する裁判所を専属合意管轄とします。
            </P>
          </Section>

          <Section title="第10条（お問い合わせ）">
            <P>本規約に関するご質問は以下までご連絡ください。</P>
            <P>メール：{CONTACT}</P>
          </Section>

        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  scroll:        { padding: 20, paddingBottom: 60, gap: 4 },
  title:         { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  meta:          { color: TEXT.hint, fontSize: 12, marginBottom: 20 },
  section:       { marginBottom: 24 },
  sectionTitle:  { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 8,
                   borderLeftWidth: 3, borderLeftColor: '#E53935', paddingLeft: 10 },
  body:          { color: TEXT.secondary, fontSize: 13, lineHeight: 22 },
  bold:          { color: '#fff', fontWeight: '700' },
  liRow:         { flexDirection: 'row', marginTop: 4 },
  bullet:        { color: '#E53935', fontSize: 13, marginTop: 1 },
})
