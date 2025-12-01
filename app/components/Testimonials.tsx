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

    </section>
  );
}
