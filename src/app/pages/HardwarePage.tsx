import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'

export function HardwarePage() {
  return (
    <>
      <PageHeader
        eyebrow="信物入口 · 可选硬件"
        title="一次触碰，打开一段关系。"
        description="信物只负责身份与进入信号，不替代手机中的记录和回应流程。没有实体设备时，也可以用软件模拟完成体验。"
        action={<ButtonLink to="/">返回首页</ButtonLink>}
      />
      <StatusPanel title="模拟桥接已连接" state="ready">
        当前可以模拟触碰、确认与关闭事件，所有入口都会经过同一套身份和授权检查。
      </StatusPanel>
      <ButtonLink to="/hardware-simulator" tone="primary">打开信物模拟器</ButtonLink>
    </>
  )
}
