import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/ui'

/** Keep in step with POLICY_VERSION in backend/app/legal.py. Changing that asks everyone to accept again. */
export const POLICY_DATE = '26 November 2026'
/** The person people write to about their data (the DPDP Act calls this the grievance contact). */
export const PRIVACY_CONTACT = 'kunalbhoomaraddi@gmail.com'

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line-soft">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link to="/" aria-label="FitAI home"><Logo /></Link>
          <div className="flex gap-5 text-sm text-fg-muted">
            <Link to="/privacy" className="hover:text-fg">Privacy</Link>
            <Link to="/terms" className="hover:text-fg">Terms</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-12">
        <h1 className="font-display text-[48px] font-extrabold uppercase leading-[.92] tracking-[.01em] sm:text-[64px]">{title}</h1>
        <p className="mt-3 text-sm text-fg-dim">Last updated {POLICY_DATE}</p>
        <div className="legal mt-10 max-w-[68ch] space-y-10 text-[15px] leading-relaxed text-fg-muted">{children}</div>
      </main>
    </div>
  )
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-lg font-semibold text-fg">{title}</h2>
      {children}
    </section>
  )
}

const ul = 'list-disc space-y-1.5 pl-5 marker:text-fg-dim'
const mail = <a href={`mailto:${PRIVACY_CONTACT}`} className="text-lime hover:underline">{PRIVACY_CONTACT}</a>

export function Privacy() {
  return (
    <LegalShell title="Privacy policy">
      <p>FitAI builds diet and training plans from details you give it. This page explains what we collect, why, who helps us run the service, and what you can do about your data. It is written to follow India's Digital Personal Data Protection Act, 2023.</p>

      <Sec title="What we collect">
        <ul className={ul}>
          <li><span className="text-fg">Account:</span> your name, email address and a scrambled (hashed) password. We never see or store your actual password.</li>
          <li><span className="text-fg">Profile:</span> age, sex, height, weight, activity level, goal, diet type, food preferences and allergies, training experience and equipment.</li>
          <li><span className="text-fg">What you log:</span> meals, water, workouts and sets, body weight and measurements, check-ins, travel or festival breaks you set, and progress photos.</li>
          <li><span className="text-fg">Coach chats:</span> the messages you send the AI coach and its replies.</li>
          <li><span className="text-fg">Technical:</span> your time zone (so "today" is your today), and short-lived sign-in codes and attempt counters that stop abuse.</li>
        </ul>
        <p>Some of this, such as weight, measurements and allergies, is health information. We treat all of it as private.</p>
      </Sec>

      <Sec title="Why we use it">
        <ul className={ul}>
          <li>To work out your calorie and protein targets and build your meal and workout plans.</li>
          <li>To show your progress, and to let the coach answer using your own logs.</li>
          <li>To send sign-in and verification codes and password-reset emails.</li>
          <li>To keep the service secure and fix errors.</li>
        </ul>
        <p>We do not sell your data, show ads, or use your data to train AI models. We only use it for the purposes above.</p>
      </Sec>

      <Sec title="Who helps us run FitAI">
        <p>These services process data for us, only to provide FitAI:</p>
        <ul className={ul}>
          <li><span className="text-fg">Neon</span> stores the database.</li>
          <li><span className="text-fg">Render</span> runs the server, and <span className="text-fg">Vercel</span> serves the website.</li>
          <li><span className="text-fg">Brevo</span> sends our emails.</li>
          <li><span className="text-fg">Google Gemini</span> (or <span className="text-fg">Groq</span> if you pick it in Settings) receives your coach messages, a summary of your profile and logs, and any meal photo you ask it to read, so it can reply.</li>
          <li><span className="text-fg">Open Food Facts</span> receives only the barcode number when you scan a packaged food.</li>
          <li><span className="text-fg">Sentry</span>, if switched on, receives error reports so we can fix crashes. We send these without your name, email, logs or photos.</li>
        </ul>
        <p>Some of these services store data outside India.</p>
      </Sec>

      <Sec title="Progress photos">
        <p>Photos are re-encoded when you upload them, which removes location and camera details. Only you can see them, and they are never sent to the AI. A meal photo you ask the coach to read is sent to the AI and is not stored by FitAI.</p>
      </Sec>

      <Sec title="How long we keep it">
        <p>We keep your data while your account is open. When you delete your account, everything is deleted from the live database straight away. Backup copies are kept for up to 30 days and then removed. Sign-in codes stop working after a few minutes, and the counters we use to slow down repeated sign-in attempts are kept in memory for about a minute.</p>
      </Sec>

      <Sec title="Your rights">
        <ul className={ul}>
          <li><span className="text-fg">See and correct:</span> everything you entered is visible and editable in the app.</li>
          <li><span className="text-fg">Get a copy:</span> Settings, then Export my data, downloads all of it as a ZIP (with spreadsheet files and your photos).</li>
          <li><span className="text-fg">Delete:</span> Settings, then Delete account, removes all of it.</li>
          <li><span className="text-fg">Withdraw consent:</span> you can withdraw at any time by deleting your account. We can't run FitAI for you without this data.</li>
          <li><span className="text-fg">Complain:</span> write to us first (below). If you are not satisfied, you can complain to the Data Protection Board of India.</li>
        </ul>
      </Sec>

      <Sec title="Age">
        <p>FitAI is for people aged 18 and over. Don't create an account if you are younger.</p>
      </Sec>

      <Sec title="Contact">
        <p>For any privacy question or complaint, email {mail}. We aim to reply within 7 days.</p>
      </Sec>

      <Sec title="Changes">
        <p>If we change this policy in a meaningful way, we will ask you to accept it again the next time you open FitAI.</p>
      </Sec>
    </LegalShell>
  )
}

export function Terms() {
  return (
    <LegalShell title="Terms of use">
      <p>By creating an account you agree to these terms. If you don't agree, please don't use FitAI.</p>

      <Sec title="Not medical advice">
        <p>FitAI gives general fitness and nutrition guidance. It is not a doctor, dietitian or physiotherapist, and it does not diagnose or treat anything. AI replies can be wrong. Talk to a qualified professional before changing your diet or training if you are pregnant, have a medical condition, take medication, or have had an eating disorder. Stop exercising and get help if you feel pain, dizziness or chest discomfort.</p>
      </Sec>

      <Sec title="Your account">
        <ul className={ul}>
          <li>You must be 18 or older.</li>
          <li>Give accurate details, since your plans are built from them.</li>
          <li>Keep your password private. You are responsible for what happens in your account.</li>
        </ul>
      </Sec>

      <Sec title="Fair use">
        <p>Don't misuse FitAI: no attempts to break in, overload the service, scrape it, or use it to harm anyone. We may limit or close accounts that do.</p>
      </Sec>

      <Sec title="Your content">
        <p>What you log and upload stays yours. You let us store and process it only to run FitAI for you, as described in the <Link to="/privacy" className="text-lime hover:underline">Privacy policy</Link>.</p>
      </Sec>

      <Sec title="The service">
        <p>FitAI is free and provided as it is. We work to keep it running and accurate but can't promise it will always be available or error-free. We may change or stop features. As far as the law allows, we are not liable for losses from using it.</p>
      </Sec>

      <Sec title="Ending your account">
        <p>You can delete your account at any time from Settings. These terms are governed by the laws of India.</p>
      </Sec>

      <Sec title="Contact">
        <p>Questions? Email {mail}.</p>
      </Sec>
    </LegalShell>
  )
}
