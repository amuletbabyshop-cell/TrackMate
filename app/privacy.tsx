// app/privacy.tsx — プライバシーポリシー
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

export default function PrivacyScreen() {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>プライバシーポリシー</Text>
          <Text style={s.meta}>{APP_NAME} / 最終更新：{LAST_UPDATED}</Text>

          <Section title="1. はじめに">
            <P>
              {APP_NAME}（以下「本アプリ」）は、陸上競技選手の怪我予防と競技力向上を目的としたトレーニング管理アプリです。
              本プライバシーポリシーは、本アプリが収集する情報と、その利用方法について説明します。
            </P>
          </Section>

          <Section title="2. 収集する情報">
            <P>本アプリは以下の情報を収集・利用します。</P>
            <Li>氏名・種目・学年などのプロフィール情報（任意入力）</Li>
            <Li>練習記録・タイム・体重・睡眠などのトレーニングデータ</Li>
            <Li>怪我・痛みの記録（部位・症状）</Li>
            <Li>食事の写真（AI分析のためのみ使用、サーバーに保存しません）</Li>
            <Li>動画フレーム画像（AI分析のためのみ使用、サーバーに保存しません）</Li>
            <Li>アプリの利用状況（広告配信のための匿名データ）</Li>
          </Section>

          <Section title="3. 情報の保存場所">
            <P>
              入力されたトレーニングデータ・プロフィール等は、原則としてお使いの端末内（AsyncStorage）にのみ保存されます。
              外部サーバーへの送信は行いません。
            </P>
          </Section>

          <Section title="4. 情報の利用目的">
            <Li>トレーニング記録の表示・管理</Li>
            <Li>怪我リスクスコアの算出</Li>
            <Li>AIによるフォーム・食事・リカバリーの分析（Anthropic Claude API を使用）</Li>
            <Li>サービスの改善・新機能の開発</Li>
          </Section>

          <Section title="5. 第三者への提供">
            <P>以下の外部サービスを利用します。個人を特定できる情報は送信しません。</P>
            <Li>
              <Text style={s.bold}>Anthropic Claude API</Text>
              {' — '}フォーム・食事・リカバリー分析のため、画像・テキストを送信します。
              Anthropic のプライバシーポリシーに従い処理されます。
            </Li>
            <Li>
              <Text style={s.bold}>Adsterra</Text>
              {' — '}無料プランの広告配信のため利用します。匿名の閲覧データを使用します。
            </Li>
            <Li>
              <Text style={s.bold}>Supabase</Text>
              {' — '}認証（メール OTP）のために使用します。
            </Li>
          </Section>

          <Section title="6. 動画・写真について">
            <P>
              アップロードされた動画・食事の写真は、AI分析のためフレーム画像に変換され Anthropic API へ送信されます。
              動画ファイル自体はサーバーに保存されず、分析完了後に破棄されます。
            </P>
          </Section>

          <Section title="7. 未成年者の利用">
            <P>
              本アプリは、中学生・高校生など未成年者の利用を想定しています。
              13歳未満の方は保護者の同意のもとでご利用ください。
              保護者の方は、お子様のデータについていつでも削除を依頼できます。
            </P>
          </Section>

          <Section title="8. データの削除">
            <P>
              アプリ内の「設定 → データ削除」からいつでも全データを削除できます。
              外部サービスへの削除依頼については下記お問い合わせ先までご連絡ください。
            </P>
          </Section>

          <Section title="9. Cookie・広告">
            <P>
              無料プランでは Adsterra の広告を表示します。広告配信のため Cookie および類似技術を使用する場合があります。
              プレミアムプランでは広告は表示されません。
            </P>
          </Section>

          <Section title="10. ポリシーの変更">
            <P>
              本ポリシーは必要に応じて改訂することがあります。重要な変更がある場合はアプリ内で通知します。
              最新版は本ページにて確認できます。
            </P>
          </Section>

          <Section title="11. お問い合わせ">
            <P>プライバシーに関するご質問・ご要望は以下までご連絡ください。</P>
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
