import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'
import { CaptureFlow } from '../../features/capture/CaptureFlow'
import { offlineDemoService } from '../../data/offlineDemo'

export function CapturePage() {
  const route = window.location.hash.slice(1) || '/capture'
  if (route !== '/capture') return <CaptureFlow route={route} service={offlineDemoService} />

  return (
    <>
      <PageHeader
        eyebrow="记忆采集 · 由记录者确认"
        title="留下一件真实的小事。"
        description="为一段具体关系保存原始内容、重要原因与未来使用边界。每条 AI 整理建议都需要你逐项确认。"
        action={<ButtonLink to="/capture/new">开始记录</ButtonLink>}
      />
      <StatusPanel title="保存前由你确认" state="ready">
        原始素材与 AI 派生内容分层保存；接收对象、可用场景和生成边界不会被系统替你决定。
      </StatusPanel>
    </>
  )
}
