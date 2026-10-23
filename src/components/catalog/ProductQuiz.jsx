import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCurrencyContext } from "../../context/CurrencyContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLightbulb, faArrowRight, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import "../../styles/productQuiz.css";

export default function ProductQuiz() {
  const { t } = useTranslation();
  const { convert, currency } = useCurrencyContext();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const questions = [
    {
      id: 1,
      question: t('quiz.questions.product_type'),
      options: [t('quiz.options.electronics'), t('quiz.options.fashion'), t('quiz.options.home_living'), t('quiz.options.sports_outdoors')]
    },
    {
      id: 2,
      question: t('quiz.questions.budget'),
      options: [
        `${t('quiz.options.under')} ${convert(50, currency)} ${currency}`,
        `${convert(50, currency)} - ${convert(100, currency)} ${currency}`,
        `${convert(100, currency)} - ${convert(200, currency)} ${currency}`,
        `${t('quiz.options.over')} ${convert(200, currency)} ${currency}`
      ]
    },
    {
      id: 3,
      question: t('quiz.questions.priority'),
      options: [t('quiz.options.quality'), t('quiz.options.price'), t('quiz.options.brand'), t('quiz.options.features')]
    }
  ];

  const handleAnswer = (answer) => {
    setAnswers({ ...answers, [currentStep]: answer });
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      calculateResult();
    }
  };

  const calculateResult = () => {
    setResult({
      category: answers[0] || t('quiz.options.electronics'),
      recommendation: t('quiz.result.recommendation')
    });
  };

  const resetQuiz = () => {
    setCurrentStep(0);
    setAnswers({});
    setResult(null);
  };

  if (result) {
    return (
      <section className="quiz-section">
        <div className="quiz-container">
          <div className="quiz-result">
            <div className="result-icon">
              <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <h2 className="result-title">{t('quiz.result.title')}</h2>
            <p className="result-text">{result.recommendation}</p>
            <p className="result-category">{t('quiz.result.category')}: <strong>{result.category}</strong></p>
            <div className="result-actions">
              <Link to="/shop" className="result-btn primary">
                {t('quiz.result.browse_products')}
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
              <button onClick={resetQuiz} className="result-btn secondary">
                {t('quiz.result.retake')}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="quiz-section">
      <div className="quiz-container">
        <div className="quiz-header">
          <div className="quiz-icon">
            <FontAwesomeIcon icon={faLightbulb} />
          </div>
          <h2 className="quiz-title">{t('quiz.title')}</h2>
          <p className="quiz-subtitle">{t('quiz.subtitle')}</p>
        </div>

        <div className="quiz-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
          <p className="progress-text">
            {t('quiz.progress', { current: currentStep + 1, total: questions.length })}
          </p>
        </div>

        <div className="quiz-content">
          <h3 className="question-text">{questions[currentStep].question}</h3>
          <div className="options-grid">
            {questions[currentStep].options.map((option, index) => (
              <button
                key={index}
                className={`option-btn ${answers[currentStep] === option ? "selected" : ""}`}
                onClick={() => handleAnswer(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {currentStep > 0 && (
          <button className="back-btn" onClick={() => setCurrentStep(currentStep - 1)}>
            <FontAwesomeIcon icon={faArrowLeft} />
            {t('quiz.previous')}
          </button>
        )}
      </div>
    </section>
  );
}
