/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "viewport3D.h"

#include "imgui.h"
#include "SDL3/SDL_gpu.h"

namespace
{

}

Editor::Viewport3D::Viewport3D()
{
}

void Editor::Viewport3D::draw() {
  ImGui::Text("Viewport");

  //  ImGui::Image(ImTextureID(fb3D), {320,240});

}
