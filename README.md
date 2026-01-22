<div style="display: flex; justify-content: center;">
  <img
    src="assets/aument.jpg"
    width="600"
    style="border-radius: 12px;"
  />
</div>
<br/>

> *“Artificial intelligence is, all things considered, only a tool.  
> Just like any tool, it is made for assisting us — in this case, to increase our intelligence, or more generally, our capabilities.”*  
>  
> <sub>— <strong>Luc Julia</strong>, co-creator of Apple’s voice assistant <em>Siri</em></sub>

Modern applications are built for human interaction—buttons, forms, menus, and visual interfaces. But as AI becomes increasingly more capable of understanding natural language commands, we face a fundamental mismatch: **AI models excel at processing text and structured data, yet we're trying to teach them to navigate human-centric UIs by clicking buttons and filling forms.**

### This approach is backwards! 

Teaching an AI where to click is like teaching someone to use a calculator by describing the physical button locations rather than explaining mathematical operations. We need a better abstraction...

...and that's where <span style="font-size: 1.4em; font-weight: 700;">Aument</span>
comes in place. It's an open-source framework that provides a standardized way to expose application business logic to AI models. It allows developers to describe their application's capabilities in a declarative, machine-readable format—essentially creating an "API for AI" that any language model can understand and execute against.

Instead of teaching AI to navigate your UI, you describe *what your application can do* in a structured format, and the AI figures out how to accomplish user goals by orchestrating those capabilities.