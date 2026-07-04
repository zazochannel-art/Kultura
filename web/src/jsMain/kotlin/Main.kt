import org.jetbrains.compose.web.renderComposable
import org.jetbrains.compose.web.dom.H1
import org.jetbrains.compose.web.dom.P
import org.jetbrains.compose.web.dom.Text

fun main() {
	renderComposable(rootElementId = "root") {
		H1 {
			Text("Kultura Web — Hello from Compose Web")
		}
		P {
			Text("This is the web port of the app. More UI will be ported incrementally.")
		}
	}
}
