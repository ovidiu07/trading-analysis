import { Card, CardContent, Grid, Typography } from '@mui/material'
import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const mockEquity = Array.from({ length: 10 }).map((_, idx) => ({ date: `Day ${idx + 1}`, value: 1000 + idx * 150 - (idx % 3) * 50 }))

const kpis = [
  { label: 'Net P&L', value: '$3,400' },
  { label: 'Win rate', value: '62%' },
  { label: 'Profit factor', value: '1.8' },
  { label: 'Expectancy', value: '$45' },
  { label: 'Max drawdown', value: '$-320' }
]

export default function DashboardPage() {
  const chartData = useMemo(() => mockEquity, [])
  return (
    <Grid container spacing={3}>
      {kpis.map((kpi) => (
        <Grid item xs={12} sm={6} md={4} key={kpi.label}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">{kpi.label}</Typography>
              <Typography variant="h5">{kpi.value}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Equity Curve</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#1976d2" fill="#bbdefb" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
