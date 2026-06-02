// src/components/home/DualCTA.tsx
export function DualCTA() {
  return (
    <section className="m-block" id="dual">
      <div className="m-wrap">
        <div className="m-dual">
          <span className="m-eyebrow">Your next move in Milton</span>
          <div className="m-dualgrid">
            <div className="m-dcard">
              <h3>Buying in Milton</h3>
              <p>
                Find the right street with the deepest local read in the city. Editorial depth
                first, then live inventory.
              </p>
              <a className="m-b2" href="/buy">
                Start your search →
              </a>
            </div>
            <div className="m-dcard">
              <h3>Selling in Milton</h3>
              <p>
                Get a grounded valuation built on real Milton sales, then a strategy matched to the
                market you&apos;re actually in.
              </p>
              <a className="m-b1" href="/sell">
                Value my home →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
