import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPhone, 
  faEnvelope, 
  faMapMarkerAlt,
  faClock,
  faPaperPlane
} from '@fortawesome/free-solid-svg-icons';
import { 
  faFacebook,
  faWhatsapp,
  faInstagram 
} from "@fortawesome/free-brands-svg-icons";
import '../styles/contact.css';

export default function Contact() {
  const { t } = useTranslation();
  
  const contactMethods = [
    {
      icon: faPhone,
      title: t('contact_page.methods.phone'),
      details: ['+237 6XX XXX XXX', '+237 6XX XXX XXX'],
      action: t('contact_page.actions.call_us')
    },
    {
      icon: faWhatsapp,
      title: t('contact_page.methods.whatsapp'),
      details: ['+237 6XX XXX XXX'],
      action: t('contact_page.actions.chat_with_us')
    },
    {
      icon: faEnvelope,
      title: t('contact_page.methods.email'),
      details: ['contact@tsogobis.com', 'support@tsogobis.com'],
      action: t('contact_page.actions.email_us')
    },
    {
      icon: faMapMarkerAlt,
      title: t('contact_page.methods.location'),
      details: ['123 Business Avenue', 'Douala, Cameroon'],
      action: t('contact_page.actions.get_directions')
    },
    {
      icon: faClock,
      title: t('contact_page.methods.hours'),
      details: ['Monday-Friday: 8AM - 6PM', 'Saturday: 9AM - 4PM'],
      action: ''
    }
  ];

  return (
    <div className="contact-page">
      {/* Hero Section */}
      <section className="contact-hero">
        <div className="contact-hero-container">
          <h1 className="contact-hero-title">
            {t('contact_page.hero_title').split(' ').slice(0, 2).join(' ')} <span className="highlight">{t('contact_page.hero_title').split(' ').slice(2).join(' ')}</span>
          </h1>
          <p className="contact-hero-subtitle">
            {t('contact_page.hero_subtitle')}
          </p>
        </div>
      </section>

      {/* Contact Methods - Moved Up */}
      <section className="contact-methods">
        <div className="contact-container">
          <h2 className="section-title">{t('contact_page.contact_options')}</h2>
          <p className="section-subtitle">
            {t('contact_page.contact_subtitle')}
          </p>
          <div className="methods-grid">
            {contactMethods.map((method, index) => (
              <div key={index} className="method-card">
                <div className="method-icon">
                  <FontAwesomeIcon icon={method.icon} />
                </div>
                <h3 className="method-title">{method.title}</h3>
                <div className="method-details">
                  {method.details.map((detail, i) => (
                    <p key={i}>{detail}</p>
                  ))}
                </div>
                {method.action && (
                  <a 
                    href={`#${method.title.toLowerCase()}`} 
                    className="method-action"
                  >
                    {method.action}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Contact Details */}
      <section className="contact-details">
        <div className="details-container">
          {/* Business Hours */}
          <div className="business-hours">
            <h3 className="details-title">{t('contact_page.details.business_hours')}</h3>
            <ul className="hours-list">
              <li>Monday-Friday: 8:00 AM - 6:00 PM</li>
              <li>Saturday: 9:00 AM - 4:00 PM</li>
              <li>Sunday: Closed</li>
            </ul>
          </div>

          {/* Team Contacts */}
          <div className="team-contacts">
            <h3 className="details-title">{t('contact_page.details.key_contacts')}</h3>
            <div className="contact-person">
              <h4>{t('contact_page.details.customer_support')}</h4>
              <p>Email: support@tsogobis.com</p>
              <p>Phone: +237 XXX XXX XXX</p>
            </div>
            <div className="contact-person">
              <h4>{t('contact_page.details.sales_inquiries')}</h4>
              <p>Email: sales@tsogobis.com</p>
              <p>Phone: +237 XXX XXX XXX</p>
            </div>
          </div>

          {/* Social Links */}
          <div className="social-links">
            <h3 className="details-title">{t('contact_page.details.connect_with_us')}</h3>
            <div className="social-icons">
              <a href="#facebook" aria-label="Facebook"><FontAwesomeIcon icon={faFacebook} /></a>
              <a href="#whatsapp" aria-label="WhatsApp"><FontAwesomeIcon icon={faWhatsapp} /></a>
              <a href="#instagram" aria-label="Instagram"><FontAwesomeIcon icon={faInstagram} /></a>
            </div>
          </div>
        </div>
      </section>

      {/* Map + Form at Bottom */}
      <div className="contact-main">
        {/* Map - Left Side */}
        <section className="map-section">
          <h2 className="section-title">{t('contact_page.office')}</h2>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3987.490895467985!2d11.5021!3d3.8480!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x108bcf7acbb1f83d%3A0x6e4a5a373e3f1a1e!2sYaound%C3%A9%2C%20Cameroon!5e0!3m2!1sen!2sus!4v1620000000000!5m2!1sen!2sus"
            width="100%"
            height="500"
            style={{border:0}}
            allowFullScreen=""
            loading="lazy"
          ></iframe>
        </section>

        {/* Contact Form - Right Side */}
        <section className="contact-form-section">
          <h2 className="section-title">{t('contact_page.form.title')}</h2>
          <form className="contact-form">
            <div className="form-group">
              <input type="text" placeholder={t('contact_page.form.name_placeholder')} required />
            </div>
            <div className="form-group">
              <input type="email" placeholder={t('contact_page.form.email_placeholder')} required />
            </div>
            <div className="form-group">
              <input type="text" placeholder={t('contact_page.form.subject_placeholder')} />
            </div>
            <div className="form-group">
              <textarea placeholder={t('contact_page.form.message_placeholder')} rows="5" required></textarea>
            </div>
            <button type="submit" className="submit-btn">
              <FontAwesomeIcon icon={faPaperPlane} />
              {t('contact_page.form.send_button')}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
