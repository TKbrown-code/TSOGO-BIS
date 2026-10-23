import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
import "../../styles/faq.css";

export default function FAQ() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: t('faq.questions.place_order'),
      answer: t('faq.answers.place_order')
    },
    {
      question: t('faq.questions.payment_methods'),
      answer: t('faq.answers.payment_methods')
    },
    {
      question: t('faq.questions.delivery_time'),
      answer: t('faq.answers.delivery_time')
    },
    {
      question: t('faq.questions.track_order'),
      answer: t('faq.answers.track_order')
    },
    {
      question: t('faq.questions.customer_support'),
      answer: t('faq.answers.customer_support')
    },
    {
      question: t('faq.questions.authentic_products'),
      answer: t('faq.answers.authentic_products')
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq-section">
      <div className="faq-container">
        <div className="faq-header">
          <div className="faq-icon">
            <FontAwesomeIcon icon={faQuestionCircle} />
          </div>
          <h2 className="faq-title">{t('faq.title')}</h2>
          <p className="faq-subtitle">{t('faq.subtitle')}</p>
        </div>

        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className={`faq-item ${openIndex === index ? "active" : ""}`}>
              <button className="faq-question" onClick={() => toggleFAQ(index)}>
                <span>{faq.question}</span>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`faq-arrow ${openIndex === index ? "rotate" : ""}`}
                />
              </button>
              <div className={`faq-answer ${openIndex === index ? "show" : ""}`}>
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
