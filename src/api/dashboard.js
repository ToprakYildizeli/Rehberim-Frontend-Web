import { pendingActions, redAlerts, activityFeed, aiInsights, students } from '../mocks/data';
import { delay } from './mockDelay';

const withStudent = (row) => ({
  ...row,
  student: students.find((x) => x.id === row.studentId),
});

export async function getPendingActions() {
  await delay();
  return pendingActions;
}

export async function getRedAlerts() {
  await delay();
  return redAlerts.map(withStudent);
}

export async function getActivityFeed() {
  await delay();
  return activityFeed.map(withStudent);
}

export async function getAiInsights() {
  await delay();
  return aiInsights.map(withStudent);
}
