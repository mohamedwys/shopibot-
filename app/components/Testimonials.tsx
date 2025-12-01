interface Testimonial {
  name: string;
  jobtitle: string;
  image: string;
  text: string;
  rating: number;
  metric: string;
}

interface TestimonialsProps {
  testimonials: Testimonial[];
}

export function Testimonials({ testimonials }: TestimonialsProps) {
  return (
    <section className="testimonials-section">
      <div className="testimonials-container">
        <div className="testimonials-header">
          <span className="testimonials-badge">Testimonials</span>
          <h2 className="testimonials-title">
            Loved by
            <span className="testimonials-highlight"> 10,000+ Store Owners</span>
          </h2>
          <p className="testimonials-subtitle">
            See how Shopibot is transforming e-commerce businesses worldwide
          </p>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial-card">
              <div className="testimonial-rating">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="star">⭐</span>
                ))}
              </div>

              <p className="testimonial-text">"{testimonial.text}"</p>

              <div className="testimonial-footer">
                <div className="testimonial-author">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="author-image"
                  />
                  <div className="author-info">
                    <div className="author-name">{testimonial.name}</div>
                    <div className="author-title">{testimonial.jobtitle}</div>
                  </div>
                </div>

                {testimonial.metric && (
                  <div className="testimonial-metric">{testimonial.metric}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .testimonials-section {
          padding: 100px 20px;
          background: linear-gradient(180deg, #f9fafb 0%, #ffffff 100%);
        }

        .testimonials-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .testimonials-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .testimonials-badge {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 20px;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          letter-spacing: 0.5px;
        }

        .testimonials-title {
          font-size: 48px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 16px 0;
          line-height: 1.2;
        }

        .testimonials-highlight {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .testimonials-subtitle {
          font-size: 20px;
          color: #6b7280;
          margin: 0;
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        .testimonial-card {
          background: white;
          padding: 32px;
          border-radius: 16px;
          border: 2px solid #f3f4f6;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .testimonial-card:hover {
          transform: translateY(-8px);
          border-color: #667eea;
          box-shadow: 0 20px 40px rgba(102, 126, 234, 0.15);
        }

        .testimonial-rating {
          display: flex;
          gap: 4px;
        }

        .star {
          font-size: 20px;
        }

        .testimonial-text {
          font-size: 16px;
          line-height: 1.6;
          color: #374151;
          margin: 0;
          flex: 1;
        }

        .testimonial-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
        }

        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .author-image {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #f3f4f6;
        }

        .author-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .author-name {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .author-title {
          font-size: 14px;
          color: #6b7280;
        }

        .testimonial-metric {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
        }

        @media (max-width: 968px) {
          .testimonials-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }

          .testimonials-title {
            font-size: 36px;
          }

          .testimonial-card {
            padding: 24px;
          }
        }

        @media (max-width: 640px) {
          .testimonials-section {
            padding: 60px 16px;
          }

          .testimonials-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .testimonials-title {
            font-size: 32px;
          }

          .testimonials-subtitle {
            font-size: 18px;
          }

          .testimonial-card {
            padding: 20px;
          }

          .testimonial-footer {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </section>
  );
}
