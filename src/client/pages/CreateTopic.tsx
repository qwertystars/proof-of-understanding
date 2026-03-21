import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface QuizQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

const emptyQuestion = (): QuizQuestion => ({
  question_text: '',
  options: ['', '', '', ''],
  correct_index: 0,
  explanation: '',
});

export default function CreateTopic() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [argsFor, setArgsFor] = useState(['']);
  const [argsAgainst, setArgsAgainst] = useState(['']);
  const [questionsFor, setQuestionsFor] = useState<QuizQuestion[]>([emptyQuestion(), emptyQuestion(), emptyQuestion()]);
  const [questionsAgainst, setQuestionsAgainst] = useState<QuizQuestion[]>([emptyQuestion(), emptyQuestion(), emptyQuestion()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const CATEGORIES = ['general', 'politics', 'technology', 'society', 'science', 'economics', 'philosophy'];

  const updateQuestion = (
    side: 'for' | 'against',
    index: number,
    field: keyof QuizQuestion,
    value: any
  ) => {
    const setter = side === 'for' ? setQuestionsFor : setQuestionsAgainst;
    setter(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateOption = (side: 'for' | 'against', qIndex: number, optIndex: number, value: string) => {
    const setter = side === 'for' ? setQuestionsFor : setQuestionsAgainst;
    setter(prev => {
      const copy = [...prev];
      const opts = [...copy[qIndex].options];
      opts[optIndex] = value;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const addQuestion = (side: 'for' | 'against') => {
    const setter = side === 'for' ? setQuestionsFor : setQuestionsAgainst;
    setter(prev => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (side: 'for' | 'against', index: number) => {
    const setter = side === 'for' ? setQuestionsFor : setQuestionsAgainst;
    setter(prev => prev.length > 3 ? prev.filter((_, i) => i !== index) : prev);
  };

  const addArg = (side: 'for' | 'against') => {
    const setter = side === 'for' ? setArgsFor : setArgsAgainst;
    setter(prev => [...prev, '']);
  };

  const updateArg = (side: 'for' | 'against', index: number, value: string) => {
    const setter = side === 'for' ? setArgsFor : setArgsAgainst;
    setter(prev => { const copy = [...prev]; copy[index] = value; return copy; });
  };

  const handleSubmit = async () => {
    setError('');
    
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }
    
    const validArgsFor = argsFor.filter(a => a.trim());
    const validArgsAgainst = argsAgainst.filter(a => a.trim());
    if (validArgsFor.length === 0 || validArgsAgainst.length === 0) {
      setError('At least one argument needed per side');
      return;
    }

    // Validate questions
    for (const side of ['for', 'against'] as const) {
      const qs = side === 'for' ? questionsFor : questionsAgainst;
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        if (!q.question_text.trim()) { setError(`${side} Q${i+1}: Question text is required`); return; }
        if (q.options.some(o => !o.trim())) { setError(`${side} Q${i+1}: All 4 options are required`); return; }
        if (!q.explanation.trim()) { setError(`${side} Q${i+1}: Explanation is required`); return; }
      }
    }

    setSubmitting(true);
    try {
      const result = await api.createTopic({
        title,
        description,
        category,
        arguments_for: validArgsFor,
        arguments_against: validArgsAgainst,
        questions_for: questionsFor,
        questions_against: questionsAgainst,
      });
      navigate(`/topic/${result.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid var(--border)',
    borderRadius: '8px', fontSize: '0.95rem', fontFamily: 'var(--sans)',
    background: 'var(--card-bg)',
  };

  const renderQuestionEditor = (side: 'for' | 'against', questions: QuizQuestion[]) => (
    <div>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: side === 'for' ? 'var(--teal)' : 'var(--amber-dark)' }}>
        Quiz: Understanding the {side === 'for' ? 'For' : 'Against'} Position
      </h3>
      <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginBottom: '16px' }}>
        These questions test whether someone understands the {side} arguments. Min 3 required.
      </p>
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="card" style={{ marginBottom: '16px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong>Question {qIdx + 1}</strong>
            {questions.length > 3 && (
              <button onClick={() => removeQuestion(side, qIdx)} style={{ background: 'none', color: 'var(--error)', fontSize: '0.8rem' }}>
                Remove
              </button>
            )}
          </div>
          <input
            style={{ ...inputStyle, marginBottom: '8px' }}
            placeholder="Question text..."
            value={q.question_text}
            onChange={e => updateQuestion(side, qIdx, 'question_text', e.target.value)}
          />
          {q.options.map((opt, optIdx) => (
            <div key={optIdx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
              <input
                type="radio"
                name={`correct-${side}-${qIdx}`}
                checked={q.correct_index === optIdx}
                onChange={() => updateQuestion(side, qIdx, 'correct_index', optIdx)}
              />
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                value={opt}
                onChange={e => updateOption(side, qIdx, optIdx, e.target.value)}
              />
            </div>
          ))}
          <textarea
            style={{ ...inputStyle, marginTop: '8px', minHeight: '60px', resize: 'vertical' }}
            placeholder="Explanation (shown after correct answer)..."
            value={q.explanation}
            onChange={e => updateQuestion(side, qIdx, 'explanation', e.target.value)}
          />
        </div>
      ))}
      <button className="btn-secondary" onClick={() => addQuestion(side)} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
        + Add Question
      </button>
    </div>
  );

  return (
    <div className="fade-in" style={{ marginBottom: '48px' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '24px' }}>Create Topic</h1>
      
      {error && (
        <div className="card" style={{ background: 'rgba(196,69,54,0.05)', borderColor: 'var(--error)', marginBottom: '16px' }}>
          <p style={{ color: 'var(--error)', fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      <div className="card">
        <label style={{ fontWeight: 500, display: 'block', marginBottom: '6px' }}>Title</label>
        <input style={inputStyle} placeholder="e.g., Should remote work be the default?" value={title} onChange={e => setTitle(e.target.value)} />
        
        <label style={{ fontWeight: 500, display: 'block', marginTop: '16px', marginBottom: '6px' }}>Description</label>
        <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} placeholder="Describe the topic in detail..." value={description} onChange={e => setDescription(e.target.value)} />
        
        <label style={{ fontWeight: 500, display: 'block', marginTop: '16px', marginBottom: '6px' }}>Category</label>
        <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      {/* Arguments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '24px 0' }}>
        <div className="card">
          <h3 style={{ color: 'var(--teal)', marginBottom: '12px' }}>Arguments For</h3>
          {argsFor.map((arg, i) => (
            <input key={i} style={{ ...inputStyle, marginBottom: '8px' }} placeholder={`Argument ${i + 1}`} value={arg}
              onChange={e => updateArg('for', i, e.target.value)} />
          ))}
          <button className="btn-secondary" onClick={() => addArg('for')} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>+ Add</button>
        </div>
        <div className="card">
          <h3 style={{ color: 'var(--amber-dark)', marginBottom: '12px' }}>Arguments Against</h3>
          {argsAgainst.map((arg, i) => (
            <input key={i} style={{ ...inputStyle, marginBottom: '8px' }} placeholder={`Argument ${i + 1}`} value={arg}
              onChange={e => updateArg('against', i, e.target.value)} />
          ))}
          <button className="btn-secondary" onClick={() => addArg('against')} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>+ Add</button>
        </div>
      </div>

      {/* Quiz Editors */}
      <div style={{ marginBottom: '24px' }}>{renderQuestionEditor('for', questionsFor)}</div>
      <div style={{ marginBottom: '24px' }}>{renderQuestionEditor('against', questionsAgainst)}</div>

      <div style={{ textAlign: 'center' }}>
        <button className="btn-primary" onClick={handleSubmit} disabled={submitting} style={{ padding: '14px 48px', fontSize: '1rem' }}>
          {submitting ? 'Creating...' : 'Publish Topic'}
        </button>
      </div>
    </div>
  );
}
