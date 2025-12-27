import { Card, CardContent, Grid, Typography } from '@mui/material'
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'

const pnlByStrategy = [
  { name: 'Breakout', value: 1200 },
  { name: 'Reversal', value: -200 },
  { name: 'Momentum', value: 500 }
]

const winLoss = [
  { name: 'Wins', value: 12 },
  { name: 'Losses', value: 5 }
]

const COLORS = ['#4caf50', '#f44336', '#2196f3']

export default function AnalyticsPage() {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Performance by strategy</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pnlByStrategy}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Win vs Loss</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={winLoss} dataKey="value" nameKey="name" outerRadius={100} label>
                  {winLoss.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
