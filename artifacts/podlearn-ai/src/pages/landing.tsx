import { useLocation } from "wouter";
import { Headphones, Mic, MessageSquare, BookOpen, Sparkles, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-violet-50/30">
      <header className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Headphones className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <span className="text-base md:text-xl font-bold text-foreground whitespace-nowrap">PodLearn AI</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setLocation("/sign-in")}
            className="px-3 md:px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => setLocation("/sign-up")}
            className="px-4 md:px-5 py-2 md:py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 whitespace-nowrap"
          >
            Get Started
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6">
        <section className="py-12 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 md:mb-8">
            <Sparkles className="w-4 h-4" />
            AI-Powered Learning
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight max-w-3xl mx-auto">
            Turn any content into an
            <span className="text-primary"> engaging podcast</span>
          </h1>
          <p className="mt-5 md:mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Paste a URL or text, and our AI hosts Jamie &amp; Alex will create a natural two-person
            conversation. Ask questions, get answers — all with voice.
          </p>
          <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <button
              onClick={() => setLocation("/sign-up")}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
            >
              Start for Free <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLocation("/sign-in")}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-medium bg-white text-foreground rounded-xl hover:bg-gray-50 transition-colors border border-border shadow-sm"
            >
              Sign In
            </button>
          </div>
        </section>

        <section className="py-10 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-5">
                <Mic className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">AI-Generated Voices</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Two distinct AI hosts discuss your content naturally — no robotic reading, just real conversation.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-5">
                <MessageSquare className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Raise Your Hand</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Pause the podcast and ask questions anytime. The hosts will answer using the source material.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-5">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Your Podcast Library</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                All your generated podcasts are saved and ready to replay. Build a personal audio knowledge base.
              </p>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-16 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to learn differently?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Create your free account and generate your first AI podcast in minutes.
          </p>
          <button
            onClick={() => setLocation("/sign-up")}
            className="px-8 py-3.5 text-base font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 flex items-center gap-2 mx-auto"
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          PodLearn AI — Transform content into conversations
        </p>
      </footer>
    </div>
  );
}
