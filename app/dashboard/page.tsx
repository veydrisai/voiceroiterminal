import KPICards from '@/components/terminal/KPICards'
import WeeklyRevenuePanel from '@/components/terminal/WeeklyRevenuePanel'
import StatCards from '@/components/terminal/StatCards'
import ConversationPipelineTable from '@/components/terminal/ConversationPipelineTable'
export default function PerformancePage() {
  return (
    <>
      <KPICards />
      <div className="main-grid">
        <WeeklyRevenuePanel />
        <StatCards />
      </div>
      <ConversationPipelineTable />
    </>
  )
}
