import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { checkAnswer, decryptExplanation } from '../lib/quiz-crypto';

type Phase = 'loading' | 'detail' | 'quiz' | 'results' | 'voted';

interface QuizQuestion {
  question_id: number;
  question_text: string;
  options: string[];
  answer_hash: string;
  encrypted_explanation: { iv: string; ciphertext: string };
}

interface QuizResult {
  questionId: number;
  selectedIndex: number;
  correct: boolean;
  explanation?: string;
}

export default function TopicDetail() {
  const { id } = useParams<{ id: string }>();
  const topicId = parseInt(id!);

  const [topic, setTopic] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [position, setPosition] = useState<'for' | 'against' | null>(null);
  const [quizData, setQuizData] = useState<{ session_id: string; salt: string; questions: QuizQuestion[]; pass_threshold: number } | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [voted, setVoted] = useState(false);
  const [votePosition, setVotePosition] = useState<string | null>(null);

  const loadTopic = useCallback(async () => {
    try {
      const data = await api.getTopic(topicId);
      setTopic(data);
      if (data.user_vote) {
        setVoted(true);
        setVotePosition(data.user_vote.position);
        setPhase('voted');
      } else {
        setPhase('detail');
      }
    } catch (e: any) {
      setError(e.message);
      setPhase('detail');
    }
  }, [topicId]);

  useEffect(() => { loadTopic(); }, [loadTopic]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const startQuiz = async (side: 'for' | 'against') => {
    setError('');
    setPosition(side);
    try {
      const data = await api.startQuiz(topicId, side);
      setQuizData(data);
      setAnswers(new Array(data.questions.length).fill(null));
      setQuizResults([]);
      setSubmitResult(null);
      setPhase('quiz');
    } catch (e: any) {
      if (e.message?.includes('wait')) {
        const match = e.message.match(/(\d+)s/);
        if (match) setCooldown(parseInt(match[1]));
      }
      setError(e.message);
    }
  };

  const selectAnswer = (qIndex: number, optIndex: number) => {
    if (submitResult) return;
    const newAnswers = [...answers];
    newAnswers[qIndex] = optIndex;
    setAnswers(newAnswers);
  };

  const submitQuiz = async () => {
    if (!quizData || answers.some(a => a === null)) return;
    setError('');
    
    // Client-side check first for instant feedback
    const clientResults: QuizResult[] = [];
    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      const selected = answers[i]!;
      const correct = await checkAnswer(q.question_id, selected, quizData.salt, q.answer_hash);
      
      let explanation: string | undefined;
      if (correct) {
        explanation = await decryptExplanation(q.question_id, selected, quizData.salt, q.encrypted_explanation);
      } else {
        // Try all options to find correct one for explanation
        for (let opt = 0; opt < q.options.length; opt++) {
          const isCorrect = await checkAnswer(q.question_id, opt, quizData.salt, q.answer_hash);
          if (isCorrect) {
            explanation = await decryptExplanation(q.question_id, opt, quizData.salt, q.encrypted_explanation);
            break;
          }
        }
      }
      
      clientResults.push({ questionId: q.question_id, selectedIndex: selected, correct, explanation });
    }
    setQuizResults(clientResults);

    // Server verification
    try {
      const result = await api.submitQuiz(topicId, quizData.session_id, answers as number[]);
      setSubmitResult(result);
      if (!result.passed) {
        setCooldown(60);
      }
      setPhase('results');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const castVote = async () => {
    if (!position) return;
    try {
      await api.vote(topicId, position);
      setVoted(true);
      setVotePosition(position);
      setPhase('voted');
      loadTopic(); // Refresh counts
    } catch (e: any) {
      setError(e.message);
    }
  };

  const flagTopic = async () => {
    try {
      await api.flagTopic(topicId);
      setError(''); // Clear any errors
      alert('Topic flagged. Thank you for helping moderate.');
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (phase === 'loading') {
    return <div className="loading"><div className="spinner" /><p>Loading topic...</p></div>;
  }

  if (!topic) {
    return <div className="card"><p>Topic not found</p><Link to="/">← Back to topics</Link></div>;
  }

  const totalVotes = topic.votes_for + topic.votes_against;
  const forPct = totalVotes > 0 ? (topic.votes_for / totalVotes) * 100 : 50;
  const gap = topic.understanding_gap;

  return (
    <div className="fade-in">
      <Link to="/" style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>← Back to topics</Link>
      
      <div style={{ marginTop: '16px' }}>
        <span className="category-badge">{topic.category}</span>
        <h1 style={{ fontSize: '2rem', marginTop: '8px', marginBottom: '12px' }}>{topic.title}</h1>
        <p style={{ color: 'var(--text-light)', lineHeight: '1.7', marginBottom: '24px' }}>{topic.description}</p>
      </div>

      {/* Understanding Gap Visualization */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', marginBottom: '16px', textAlign: 'center', color: 'var(--text-light)' }}>
          Understanding Gap
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '16px' }}>
          <div className="gap-stat">
            <div className="gap-stat-value" style={{ color: 'var(--teal)' }}>
              {(topic.pass_rate_for * 100).toFixed(0)}%
            </div>
            <div className="gap-stat-label">For side pass rate</div>
          </div>
          <div className="gap-stat">
            <div className="gap-stat-value" style={{ color: 'var(--text)' }}>
              {(gap * 100).toFixed(0)}%
            </div>
            <div className="gap-stat-label">Gap</div>
          </div>
          <div className="gap-stat">
            <div className="gap-stat-value" style={{ color: 'var(--amber-dark)' }}>
              {(topic.pass_rate_against * 100).toFixed(0)}%
            </div>
            <div className="gap-stat-label">Against side pass rate</div>
          </div>
        </div>
        
        <div className="gap-container">
          <div className="gap-bar">
            <div className="gap-bar-for" style={{ width: `${forPct}%` }} />
            <div className="gap-bar-against" style={{ width: `${100 - forPct}%` }} />
          </div>
          <div className="gap-labels">
            <span>For: {topic.votes_for} votes</span>
            <span>Against: {topic.votes_against} votes</span>
          </div>
        </div>
      </div>

      {/* Arguments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '24px 0' }}>
        <div className="card" style={{ borderTop: '3px solid var(--teal)' }}>
          <h3 style={{ color: 'var(--teal)', marginBottom: '12px', fontSize: '1rem' }}>Arguments For</h3>
          <ul style={{ paddingLeft: '16px' }}>
            {(topic.arguments_for || []).map((arg: string, i: number) => (
              <li key={i} style={{ marginBottom: '8px', fontSize: '0.9rem', lineHeight: '1.5' }}>{arg}</li>
            ))}
          </ul>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--amber)' }}>
          <h3 style={{ color: 'var(--amber-dark)', marginBottom: '12px', fontSize: '1rem' }}>Arguments Against</h3>
          <ul style={{ paddingLeft: '16px' }}>
            {(topic.arguments_against || []).map((arg: string, i: number) => (
              <li key={i} style={{ marginBottom: '8px', fontSize: '0.9rem', lineHeight: '1.5' }}>{arg}</li>
            ))}
          </ul>
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: 'rgba(196,69,54,0.05)', borderColor: 'var(--error)', marginBottom: '16px' }}>
          <p style={{ color: 'var(--error)', fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      {/* Phase: Detail — Choose side */}
      {phase === 'detail' && !topic.user_passed_quiz && (
        <div className="card slide-up">
          <h3 style={{ textAlign: 'center', marginBottom: '8px' }}>Choose Your Position</h3>
          <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '20px' }}>
            You'll need to prove you understand the <strong>opposing</strong> side before your vote counts.
          </p>
          <div className="vote-section">
            <button className="vote-btn for-btn" onClick={() => startQuiz('for')} disabled={cooldown > 0}>
              I'm For {cooldown > 0 && `(${cooldown}s)`}
            </button>
            <button className="vote-btn against-btn" onClick={() => startQuiz('against')} disabled={cooldown > 0}>
              I'm Against {cooldown > 0 && `(${cooldown}s)`}
            </button>
          </div>
        </div>
      )}

      {/* Phase: Detail — Already passed, can vote */}
      {phase === 'detail' && topic.user_passed_quiz && !voted && (
        <div className="card slide-up unlock-animation">
          <h3 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--teal)' }}>
            ✓ Quiz Passed — You may vote!
          </h3>
          <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '20px' }}>
            You demonstrated understanding. Your vote counts.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => { setPosition(topic.user_passed_quiz.position); castVote(); }}>
              Cast Vote: {topic.user_passed_quiz.position === 'for' ? 'For' : 'Against'}
            </button>
          </div>
        </div>
      )}

      {/* Phase: Quiz */}
      {phase === 'quiz' && quizData && (
        <div className="slide-up">
          <div className="card" style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h3>Understanding Quiz</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: '4px' }}>
              You chose <strong>{position}</strong>. Now prove you understand the <strong>{position === 'for' ? 'against' : 'for'}</strong> position.
            </p>
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '8px' }}>
              {answers.filter(a => a !== null).length} of {quizData.questions.length} answered · Need 70% to pass
            </p>
          </div>

          {quizData.questions.map((q, qIdx) => (
            <div key={q.question_id} className="quiz-question card">
              <h3>Q{qIdx + 1}. {q.question_text}</h3>
              {q.options.map((opt, optIdx) => {
                let className = 'quiz-option';
                if (answers[qIdx] === optIdx) className += ' selected';
                if (quizResults.length > 0) {
                  const result = quizResults[qIdx];
                  if (result) {
                    if (optIdx === result.selectedIndex) {
                      className += result.correct ? ' correct' : ' incorrect';
                    }
                  }
                }
                return (
                  <button
                    key={optIdx}
                    className={className}
                    onClick={() => selectAnswer(qIdx, optIdx)}
                    disabled={quizResults.length > 0}
                  >
                    {String.fromCharCode(65 + optIdx)}. {opt}
                  </button>
                );
              })}
              {quizResults[qIdx]?.explanation && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  background: 'rgba(42,157,143,0.06)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  borderLeft: '3px solid var(--teal)',
                }}>
                  <strong>Explanation:</strong> {quizResults[qIdx].explanation}
                </div>
              )}
            </div>
          ))}

          {!submitResult && (
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <button 
                className="btn-primary"
                onClick={submitQuiz}
                disabled={answers.some(a => a === null)}
                style={{ padding: '14px 48px', fontSize: '1rem' }}
              >
                Submit Answers
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phase: Results */}
      {phase === 'results' && submitResult && (
        <div className="card slide-up" style={{ textAlign: 'center', marginTop: '24px' }}>
          {submitResult.passed ? (
            <>
              <div className="unlock-animation" style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
              <h2 style={{ color: 'var(--teal)', marginBottom: '8px' }}>You Passed!</h2>
              <p style={{ fontSize: '1.2rem', marginBottom: '4px' }}>
                Score: {submitResult.correct}/{submitResult.total} ({(submitResult.score * 100).toFixed(0)}%)
              </p>
              <p style={{ color: 'var(--text-light)', marginBottom: '20px' }}>
                You've demonstrated genuine understanding of the opposing position.
              </p>
              <button className="btn-primary" onClick={castVote} style={{ padding: '14px 48px' }}>
                Cast My Vote: {position === 'for' ? 'For' : 'Against'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📚</div>
              <h2 style={{ marginBottom: '8px' }}>Not Quite Yet</h2>
              <p style={{ fontSize: '1.2rem', marginBottom: '4px' }}>
                Score: {submitResult.correct}/{submitResult.total} ({(submitResult.score * 100).toFixed(0)}%)
              </p>
              <p style={{ color: 'var(--text-light)', marginBottom: '20px' }}>
                Take a moment to review the opposing arguments above. Understanding different perspectives makes us all better thinkers.
              </p>
              <button 
                className="btn-secondary" 
                onClick={() => { setPhase('detail'); setQuizData(null); setQuizResults([]); setSubmitResult(null); }}
                disabled={cooldown > 0}
                style={{ padding: '14px 48px' }}
              >
                {cooldown > 0 ? `Try Again in ${cooldown}s` : 'Try Again'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Phase: Voted */}
      {phase === 'voted' && (
        <div className="card slide-up" style={{ textAlign: 'center', marginTop: '24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✓</div>
          <h2 style={{ color: 'var(--teal)', marginBottom: '8px' }}>Vote Recorded</h2>
          <p style={{ color: 'var(--text-light)' }}>
            You voted <strong style={{ color: votePosition === 'for' ? 'var(--teal)' : 'var(--amber-dark)' }}>
              {votePosition === 'for' ? 'For' : 'Against'}
            </strong>
          </p>
        </div>
      )}

      {/* Flag */}
      <div style={{ textAlign: 'center', marginTop: '32px', marginBottom: '48px' }}>
        <button 
          onClick={flagTopic}
          style={{ background: 'none', color: 'var(--text-light)', fontSize: '0.8rem', textDecoration: 'underline' }}
        >
          Flag this topic
        </button>
      </div>
    </div>
  );
}
