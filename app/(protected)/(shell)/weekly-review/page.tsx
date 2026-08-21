import pageStyles from "@/components/page-header.module.css";
import { WeeklyReviewFlow } from "@/components/weekly-review/weekly-review-flow";
import { getWeeklyReviewSession } from "@/lib/weekly-review/session";
import { getStaleTasks, getHabitReviewCards, getRankCandidates, getReviewNumbers, getReviewDigestDraft } from "@/lib/weekly-review/data";

export default async function WeeklyReviewPage() {
  const session = await getWeeklyReviewSession();
  const [staleTasks, habitCards, rankCandidates, numbers, digestDraft] = await Promise.all([
    getStaleTasks(),
    getHabitReviewCards(session.verdicts),
    getRankCandidates(session.rankOrder),
    getReviewNumbers(),
    session.draftDigest !== null ? Promise.resolve(session.draftDigest) : getReviewDigestDraft(),
  ]);

  return (
    <>
      <div className={pageStyles.content}>
        <WeeklyReviewFlow
          initialStep={session.step}
          staleTasks={staleTasks}
          habitCards={habitCards}
          rankCandidates={rankCandidates}
          numbers={numbers}
          digestDraft={digestDraft}
        />
      </div>
    </>
  );
}
